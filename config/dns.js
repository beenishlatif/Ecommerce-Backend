import dns from 'node:dns';

// Fixes environments where the default/system DNS resolver is broken, slow,
// or blocked (common on some VPS/hosting setups and some serverless
// environments), by pointing Node at public resolvers instead. This matters
// a lot for MongoDB Atlas: "mongodb+srv://" URIs require a DNS SRV lookup,
// and that lookup is exactly what fails first when a host's DNS is bad —
// producing errors like "querySrv ETIMEOUT" or "ENOTFOUND". Override via
// DNS_SERVERS in .env (comma-separated) if you need different resolvers.
//
// Never throws — worst case, it logs a warning and Node keeps using
// whatever resolver it already had, so this can never crash the app.
export function configureDNS() {
  try {
    const fromEnv = process.env.DNS_SERVERS;
    const servers = fromEnv
      ? fromEnv.split(',').map((s) => s.trim()).filter(Boolean)
      : ['1.1.1.1', '8.8.8.8'];

    if (servers.length > 0) {
      dns.setServers(servers);
      console.log(`🌐 DNS resolvers set to: ${servers.join(', ')}`);
    }
  } catch (err) {
    console.warn('⚠️  Could not set custom DNS servers, continuing with system default:', err.message);
  }

  try {
    // Prefer IPv4 results first — avoids slow/broken IPv6 resolution paths
    // that some hosts and networks have, another common source of hangs.
    if (typeof dns.setDefaultResultOrder === 'function') {
      dns.setDefaultResultOrder('ipv4first');
    }
  } catch (err) {
    console.warn('⚠️  Could not set DNS result order, continuing with default:', err.message);
  }
}
