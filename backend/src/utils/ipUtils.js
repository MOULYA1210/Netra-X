/**
 * IP Utility Functions
 * Validates and parses IP ranges before sending to Nmap
 */

// Validate single IPv4 address
const isValidIP = (ip) => {
  const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!pattern.test(ip)) return false;
  return ip.split('.').every((octet) => parseInt(octet) >= 0 && parseInt(octet) <= 255);
};

// Validate CIDR notation (e.g. 192.168.1.0/24)
const isValidCIDR = (cidr) => {
  const parts = cidr.split('/');
  if (parts.length !== 2) return false;
  const prefix = parseInt(parts[1]);
  return isValidIP(parts[0]) && prefix >= 0 && prefix <= 32;
};

// Validate IP range (e.g. 192.168.1.1-50)
const isValidIPRange = (range) => {
  const parts = range.split('-');
  if (parts.length !== 2) return false;
  return isValidIP(parts[0]) && parseInt(parts[1]) >= 0 && parseInt(parts[1]) <= 255;
};

// Master validator — accepts IP, CIDR, or range
const isValidScanTarget = (target) => {
  const trimmed = target.trim();
  return isValidIP(trimmed) || isValidCIDR(trimmed) || isValidIPRange(trimmed);
};

// Estimate host count from CIDR (for UI feedback)
const estimateHostCount = (cidr) => {
  if (!isValidCIDR(cidr)) return 1;
  const prefix = parseInt(cidr.split('/')[1]);
  return Math.pow(2, 32 - prefix) - 2; // Subtract network + broadcast
};

module.exports = {
  isValidIP,
  isValidCIDR,
  isValidIPRange,
  isValidScanTarget,
  estimateHostCount,
};