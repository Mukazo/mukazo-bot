// utils/cooldownConfig.js

module.exports = {
  Summon: {
    default: 120 * 1000,
    reductions: [
  { id: '1387230787929243780', percent: 15, group: 'patreon' }, // Booster
  { id: '1394845122180677662', percent: 20, group: 'patreon' }, // Maknae
  { id: '1394846623971938465', percent: 25, group: 'patreon' }, // Visual
  { id: '1394847239557615666', percent: 35, group: 'patreon' }, // Leader

  { id: '1386797424953135156', percent: 5 },  // Hearties
  { id: '1394448143206322267', percent: 10 }, // Huntrixbot
  { id: '1412071548881473598', percent: 40 }, // All Rounder
    ]
  },
  
  Route: {
    default: 15 * 60 * 1000,
    reductions: [
  { id: '1387230787929243780', percent: 15, group: 'patreon' }, // Booster
  { id: '1394845122180677662', percent: 20, group: 'patreon' }, // Maknae
  { id: '1394846623971938465', percent: 25, group: 'patreon' }, // Visual
  { id: '1394847239557615666', percent: 35, group: 'patreon' }, // Leader

  { id: '1386797424953135156', percent: 5 },  // Hearties
  { id: '1394448143206322267', percent: 10 }, // Huntrixbot
  { id: '1412071548881473598', percent: 40 }, // All Rounder
    ]
  },
  // Add more as needed
};