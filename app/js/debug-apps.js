// TEMPORARY: on-screen report of how the app list was filtered, to find why YouTube is missing.
// Shown for 2 minutes after the apps load. Delete this file and its call in main.js afterwards.
export function showAppsDebug(all, kept, visibleById) {
  const counts = new Map();
  for (const a of all) if (a.icon) counts.set(a.icon, (counts.get(a.icon) || 0) + 1);
  const keptIds = new Set(kept.map((a) => a.id));
  const lines = [
    `APP LIST DEBUG (closes in 2 min) - received ${all.length}, with picture ${all.filter((a) => a.icon).length}, ` +
      `kept by rules ${kept.length}, shown ${Object.keys(visibleById).filter((k) => visibleById[k]).length}`,
  ];
  const tube = all.filter((a) => /tube/i.test(`${a.name} ${a.id}`));
  lines.push(`YouTube-like entries received: ${tube.length}${tube.length ? '' : '  (none: hidden by the projector)'}`);
  tube.forEach((a, i) => {
    const pic = a.icon ? `ok (${a.icon.length})` : `none${a.iconError ? ' - ' + a.iconError : ''}`;
    const vis = a.id in visibleById ? (visibleById[a.id] ? 'yes' : 'NO') : '-';
    lines.push(`${i + 1}. ${a.name} [${a.id}]`);
    lines.push(`   picture: ${pic}   same picture: ${a.icon ? counts.get(a.icon) : '-'} apps   kept: ${keptIds.has(a.id) ? 'yes' : 'NO'}   picture visible: ${vis}`);
  });
  const big = [...counts.values()].filter((n) => n >= 2).sort((x, y) => y - x);
  lines.push(`Pictures shared by 2+ apps (sizes): ${big.length ? big.slice(0, 12).join(', ') : 'none'}`);
  const box = document.createElement('pre');
  box.textContent = lines.join('\n');
  box.style.cssText = 'position:absolute;left:40px;top:40px;right:40px;z-index:50;margin:0;padding:28px;background:rgba(0,0,0,.94);' +
    'color:#fff;font:24px/1.4 monospace;border:3px solid #ff0;border-radius:16px;white-space:pre-wrap;pointer-events:none;';
  document.getElementById('screen').appendChild(box);
  setTimeout(() => box.remove(), 120000);
}
