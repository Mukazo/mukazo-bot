// utils/cooldownConfig.js

const bewitch = require("../commands/global/bewitch");

module.exports = {
  Summon: {
    default: 150 * 1000,
    reductions: [
  { id: '1447006737042378772', percent: 15, group: 'patreon' }, // Daydream
  { id: '1447006766733725747', percent: 25, group: 'patreon' }, // Ethereal
  { id: '1447006809419415622', percent: 40, group: 'patreon' }, // Stardust

  { id: '1447197066156703774', percent: 10 },  // Booster
  { id: '1459260084034076823', percent: 5 },  // /mukazobot
    ]
  },
  
  Route: {
    default: 20 * 60 * 1000,
    reductions: [
  { id: '1447006737042378772', percent: 15, group: 'patreon' }, // Daydream
  { id: '1447006766733725747', percent: 25, group: 'patreon' }, // Ethereal
  { id: '1447006809419415622', percent: 40, group: 'patreon' }, // Stardust

  { id: '1447197066156703774', percent: 10 },  // Booster
  { id: '1459260084034076823', percent: 5 },  // /mukazobot
    ]
  },
  Bewitch: {
    default: 35 * 60 * 1000,
    reductions: [
  { id: '1447006737042378772', percent: 15, group: 'patreon' }, // Daydream
  { id: '1447006766733725747', percent: 25, group: 'patreon' }, // Ethereal
  { id: '1447006809419415622', percent: 40, group: 'patreon' }, // Stardust

  { id: '1447197066156703774', percent: 10 },  // Booster
  { id: '1459260084034076823', percent: 5 },  // /mukazobot
    ]
  },
  Daily: 24 * 60 * 60 * 1000,
  Enchant: 30 * 1000,
  Weekly: 7 * 24 * 60 * 60 * 1000,
  // Add more as needed
};