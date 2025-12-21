/**
 * Generate a version label with a custom emoji for each version.
 * 
 * @param {object} options
 * @param {number|string} options.version - Version number (1–5).
 * @returns {string}
 */
module.exports = function generateVersion({ version = 1 }) {
  const versionEmojis = {
    1: '<:one:1452220520954069105>', // Version 1 emoji
    2: '<:two:1452220520027394150>', // Version 2 emoji
    3: '<:three:1452220518827692173>', // Version 3 emoji
    4: '<:four:1452220517904814142>', // Version 4 emoji
    5: '<:JAN26:1452220517062021181>'  // Version 5 emoji
  };

  let value = 1;

  if (typeof version === 'string') {
    const match = version.match(/^(\d)/); // handles "3" or "3Alpha"
    if (match) value = parseInt(match[1]);
  } else if (typeof version === 'number') {
    value = version;
  }

  const clamped = Math.max(1, Math.min(5, value));
  return versionEmojis[clamped] || '';
};