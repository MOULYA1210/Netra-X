const snmp = require('net-snmp');
const Metric = require('../models/Metric');
const Device = require('../models/Device');
const { broadcast } = require('../utils/websocket');
const logger = require('../utils/logger');

/**
 * Standard SNMP OIDs — universal across vendors
 */
const OIDs = {
  sysDescr:     '1.3.6.1.2.1.1.1.0',
  sysUptime:    '1.3.6.1.2.1.1.3.0',
  cpuUsage:     '1.3.6.1.2.1.25.3.3.1.2.1',
  ifInOctets:   '1.3.6.1.2.1.2.2.1.10',
  ifOutOctets:  '1.3.6.1.2.1.2.2.1.16',
  ifDescr:      '1.3.6.1.2.1.2.2.1.2',
  ifOperStatus: '1.3.6.1.2.1.2.2.1.8',
  ifSpeed:      '1.3.6.1.2.1.2.2.1.5',
};

/**
 * Create a net-snmp session for a device
 */
const createSession = (host, community = 'public') => {
  return snmp.createSession(host, community, {
    version: snmp.Version2c,
    timeout: 5000,
    retries: 1,
  });
};

/**
 * Get multiple OIDs from a device in one request
 */
const snmpGet = (host, community, oids) => {
  return new Promise((resolve, reject) => {
    const session = createSession(host, community);

    session.get(oids, (err, varbinds) => {
      session.close();
      if (err) return reject(err);

      const result = {};
      varbinds.forEach((vb, i) => {
        if (!snmp.isVarbindError(vb)) {
          result[oids[i]] = vb.value;
        }
      });
      resolve(result);
    });
  });
};

/**
 * Walk an SNMP subtree (for interface tables)
 */
const snmpWalk = (host, community, oid) => {
  return new Promise((resolve) => {
    const session = createSession(host, community);
    const results = [];

    session.subtree(
      oid,
      20, // maxRepetitions
      (varbinds) => {
        varbinds.forEach((vb) => {
          if (!snmp.isVarbindError(vb)) {
            results.push({ oid: vb.oid, value: vb.value });
          }
        });
      },
      (err) => {
        session.close();
        // Resolve even on error — partial data is better than none
        resolve(results);
      }
    );
  });
};

/**
 * Collect SNMP metrics from a single device
 */
const collectSNMP = async (device) => {
  const { ipAddress, snmpCommunity = 'public' } = device;

  try {
    // Get scalar values
    const scalars = await snmpGet(ipAddress, snmpCommunity, [
      OIDs.sysUptime,
      OIDs.cpuUsage,
    ]).catch(() => ({}));

    const uptime   = scalars[OIDs.sysUptime]
      ? Math.floor(parseInt(scalars[OIDs.sysUptime]) / 100)
      : null;
    const cpuUsage = scalars[OIDs.cpuUsage]
      ? parseInt(scalars[OIDs.cpuUsage])
      : null;

    // Walk interface stats
    let interfaces = [];
    try {
      const [inData, outData, descrData, statusData] = await Promise.all([
        snmpWalk(ipAddress, snmpCommunity, OIDs.ifInOctets),
        snmpWalk(ipAddress, snmpCommunity, OIDs.ifOutOctets),
        snmpWalk(ipAddress, snmpCommunity, OIDs.ifDescr),
        snmpWalk(ipAddress, snmpCommunity, OIDs.ifOperStatus),
      ]);

      interfaces = inData.map((item, i) => ({
        index: i + 1,
        name:      descrData[i]?.value?.toString()  || `if${i + 1}`,
        inOctets:  parseInt(item.value)              || 0,
        outOctets: parseInt(outData[i]?.value)       || 0,
        status:    statusData[i]?.value === 1 ? 'up' : 'down',
      }));
    } catch {
      // Interface walk failed — not critical
    }

    const metric = await Metric.create({
      deviceId: device._id,
      ipAddress,
      type: 'snmp',
      snmp: { cpuUsage, uptime, interfaces },
    });

    broadcast('SNMP_UPDATE', {
      deviceId:       device._id,
      deviceName:     device.name,
      ipAddress,
      cpuUsage,
      uptime,
      interfaceCount: interfaces.length,
    });

    logger.debug(
      `[SNMP] ${device.name} (${ipAddress}) — CPU: ${cpuUsage ?? 'N/A'}%, Uptime: ${uptime ?? 'N/A'}s`
    );

    return metric;
  } catch (err) {
    logger.warn(`[SNMP] Failed for ${device.name} (${ipAddress}): ${err.message}`);
    return null;
  }
};

/**
 * Collect SNMP from all SNMP-enabled devices
 */
const collectAllSNMP = async () => {
  const devices = await Device.find({ monitoringEnabled: true, snmpEnabled: true });

  if (devices.length === 0) {
    logger.debug('[SNMP] No SNMP-enabled devices');
    return;
  }

  logger.debug(`[SNMP] Collecting from ${devices.length} device(s)...`);

  const results = await Promise.allSettled(
    devices.map((device) => collectSNMP(device))
  );

  const ok = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  logger.info(`[SNMP] Complete — ${ok}/${devices.length} responded`);
};

module.exports = { collectSNMP, collectAllSNMP, snmpGet };