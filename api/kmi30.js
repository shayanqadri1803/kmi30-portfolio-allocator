module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');

  try {
    const r = await fetch('https://dps.psx.com.pk/indices/KMI30', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!r.ok) throw new Error(`PSX returned HTTP ${r.status}`);

    const html = await r.text();
    const stocks = [];

    // Each row: <tr><td data-order="SYMBOL">...</td><td>Name</td>...<td class="right">WT%</td>...
    const rowRe = /<tr><td data-order="([^"]+)">([\s\S]*?)<\/tr>/g;
    let m;

    while ((m = rowRe.exec(html)) !== null) {
      const symbol = m[1];
      const row = m[0];

      // Name is the first plain <td> (no attributes) after the symbol cell
      const nameM = row.match(/<\/td><td>([^<]+)<\/td>/);
      const name = nameM ? decodeEntities(nameM[1].trim()) : '';

      // IDX WTG (%): the only <td class="right"> with no data-order that holds a bare "X.XX%"
      const wtgM = row.match(/<td class="right">([\d.]+%)<\/td>/);
      if (!wtgM) continue;

      const weight = parseFloat(wtgM[1]);
      if (!name || isNaN(weight)) continue;

      stocks.push({ symbol, name, weight });
    }

    // Sort heaviest first (PSX returns them alphabetically)
    stocks.sort((a, b) => b.weight - a.weight);

    res.status(200).json({ stocks, count: stocks.length, fetchedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
};

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
