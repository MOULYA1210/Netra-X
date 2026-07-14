const nmap = require('node-nmap');
const { v4: uuidv4 } = require('uuid');
const Device = require('../models/Device');
const ScanJob = require('../models/ScanJob');
const logger = require('../utils/logger');

// Point node-nmap to Nmap binary on Windows
nmap.nmapLocation = 'nmap'; // Works if Nmap is in PATH
// If not in PATH, use full path:
// nmap.nmapLocation = 'C:\\Program Files (x86)\\Nmap\\nmap.exe';

/**
 * Scan profiles — different Nmap flags for different use cases
 *
 * quick    → Fast ping sweep, no port scan. Best for large ranges.
 * standard → OS detection + top 100 ports. Balanced.
 * deep     → Full port scan + service versions. Slow but thorough.
 */
const SCAN_PROFILES = {
  quick: {
    flags: '-sn -T4',         // Ping sweep only, aggressive timing
    description: 'Ping sweep (no port scan)',
  },
  standard: {
    flags: '-sV -O -T4 --top-ports 100 --osscan-guess',
    description: 'OS detection + top 100 ports',
  },
  deep: {
    flags: '-sV -O -T3 -p-', // All 65535 ports — use carefully!
    description: 'Full port scan',
  },
};

/**
 * Parse raw Nmap host data into our clean schema
 */
const parseHost = (host) => {
  const openPorts = [];

  // Extract port data if available
  if (host.openPorts && Array.isArray(host.openPorts)) {
    host.openPorts.forEach((p) => {
      openPorts.push({
        port: parseInt(p.port) || 0,
        protocol: p.protocol || 'tcp',
        service: p.service || 'unknown',
        state: p.state || 'open',
      });
    });
  }

  return {
    ipAddress: host.ip || null,
    hostname: host.hostname && host.hostname !== '' ? host.hostname : null,
    status: host.alive ? 'up' : 'down',
    mac: host.mac || null,
    vendor: host.vendor || 'Unknown',
    os: host.osNmap || null,
    openPorts,
    responseTime: host.responseTime ? parseFloat(host.responseTime) : null,
  };
};

/**
 * Infer device type from open ports and OS string
 * This is a simple heuristic — Phase 5 AI will improve this
 */
const inferDeviceType = (parsedHost) => {
  const os = (parsedHost.os || '').toLowerCase();
  const ports = parsedHost.openPorts.map((p) => p.port);

  if (os.includes('router') || os.includes('cisco') || os.includes('juniper')) return 'router';
  if (os.includes('switch')) return 'switch';
  if (os.includes('firewall') || os.includes('pfsense') || os.includes('fortinet')) return 'firewall';
  if (ports.includes(22) || ports.includes(80) || ports.includes(443) || ports.includes(8080)) return 'server';
  if (ports.includes(161)) return 'router'; // SNMP usually on network gear
  return 'unknown';
};

/**
 * Save or update discovered hosts in the Device collection
 * Uses upsert — if device with that IP exists, update it; otherwise create it
 */
const saveDiscoveredDevices = async (hosts) => {
  let newCount = 0;
  let updatedCount = 0;

  for (const host of hosts) {
    if (!host.ipAddress || host.status !== 'up') continue;

    const deviceData = {
      ipAddress: host.ipAddress,
      name: host.hostname || `Device-${host.ipAddress}`,
      macAddress: host.mac || null,
      vendor: host.vendor || 'Unknown',
      os: host.os || null,
      type: inferDeviceType(host),
      status: 'online',
      lastSeen: new Date(),
      discoveryMethod: 'nmap',
      discoveredAt: new Date(),
    };

    // upsert: update if IP exists, insert if not
    const result = await Device.findOneAndUpdate(
      { ipAddress: host.ipAddress },
      { $set: deviceData },
      { upsert: true, new: true, rawResult: true }
    );

    // rawResult tells us if it was an insert or update
    if (result.lastErrorObject.updatedExisting) {
      updatedCount++;
    } else {
      newCount++;
    }
  }

  return { newCount, updatedCount };
};

/**
 * Main scan function — called by controller
 * Returns jobId immediately, runs scan async
 */
const startScan = async (target, scanType = 'standard', triggeredBy = 'api') => {
  const jobId = uuidv4();

  // Create scan job record immediately
  const job = await ScanJob.create({
    jobId,
    target,
    scanType,
    status: 'queued',
    triggeredBy,
  });

  logger.info(`[Scanner] Job ${jobId} queued — Target: ${target}, Type: ${scanType}`);

  // Run scan asynchronously (don't await — return jobId to client immediately)
  runScan(jobId, target, scanType).catch((err) => {
    logger.error(`[Scanner] Job ${jobId} failed: ${err.message}`);
  });

  return jobId;
};

/**
 * The actual Nmap scan — runs in background
 */
const runScan = async (jobId, target, scanType) => {
  const startTime = Date.now();
  const profile = SCAN_PROFILES[scanType] || SCAN_PROFILES.standard;

  // Mark job as running
  await ScanJob.findOneAndUpdate(
    { jobId },
    { status: 'running', startedAt: new Date() }
  );

  logger.info(`[Scanner] Job ${jobId} started — ${profile.description}`);

  return new Promise((resolve, reject) => {
    // Initialize Nmap scan
    const nmapScan = new nmap.NmapScan(target, profile.flags);

    nmapScan.on('complete', async (data) => {
      try {
        const parsedHosts = (data || []).map(parseHost);
        const liveHosts = parsedHosts.filter((h) => h.status === 'up');

        logger.info(`[Scanner] Job ${jobId} — Found ${liveHosts.length} live hosts`);

        // Save to database
        const { newCount, updatedCount } = await saveDiscoveredDevices(liveHosts);

        const duration = Math.round((Date.now() - startTime) / 1000);

        // Update job as completed
        await ScanJob.findOneAndUpdate(
          { jobId },
          {
            status: 'completed',
            completedAt: new Date(),
            duration,
            hostsScanned: parsedHosts.length,
            hostsFound: liveHosts.length,
            newDevices: newCount,
            updatedDevices: updatedCount,
            results: liveHosts,
          }
        );

        logger.info(
          `[Scanner] Job ${jobId} complete — ${liveHosts.length} hosts, ${newCount} new, ${updatedCount} updated (${duration}s)`
        );

        resolve({ jobId, liveHosts, newCount, updatedCount });
      } catch (err) {
        await failJob(jobId, err.message);
        reject(err);
      }
    });

    nmapScan.on('error', async (err) => {
      await failJob(jobId, err.toString());
      reject(new Error(err));
    });

    nmapScan.startScan();
  });
};

// Helper to mark a job as failed
const failJob = async (jobId, errorMessage) => {
  await ScanJob.findOneAndUpdate(
    { jobId },
    { status: 'failed', completedAt: new Date(), errorMessage }
  );
  logger.error(`[Scanner] Job ${jobId} failed: ${errorMessage}`);
};

/**
 * Get job status — polled by frontend
 */
const getJobStatus = async (jobId) => {
  return ScanJob.findOne({ jobId });
};

/**
 * Get scan history
 */
const getScanHistory = async (limit = 10) => {
  return ScanJob.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('-results'); // Exclude full results from list view
};

module.exports = {
  startScan,
  getJobStatus,
  getScanHistory,
  SCAN_PROFILES,
};