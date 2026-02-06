const Store = require('electron-store');

const schema = {
  gateways: {
    type: 'array',
    default: [],
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        url: { type: 'string' },
        token: { type: 'string' }
      }
    }
  },
  activeGateway: {
    type: ['string', 'null'],
    default: null
  },
  hotkey: {
    type: 'string',
    default: 'CommandOrControl+Shift+L'
  },
  nextAgentHotkey: {
    type: 'string',
    default: 'CommandOrControl+Shift+Right'
  },
  prevAgentHotkey: {
    type: 'string',
    default: 'CommandOrControl+Shift+Left'
  },
  toggleThemeHotkey: {
    type: 'string',
    default: 'CommandOrControl+Shift+K'
  },
  windowBounds: {
    type: 'object',
    default: { x: undefined, y: undefined, width: 400, height: 600 },
    properties: {
      x: { type: ['number', 'null'] },
      y: { type: ['number', 'null'] },
      width: { type: 'number' },
      height: { type: 'number' }
    }
  },
  // Session management
  sessions: {
    type: 'object',
    default: {},
    // Structure: { gatewayId: [{ id, name, url }] }
  },
  activeSessionWindows: {
    type: 'object',
    default: {},
    // Structure: { windowId: { gatewayId, sessionId } }
  },
  sessionWindowBounds: {
    type: 'object',
    default: {},
    // Structure: { sessionId: { x, y, width, height } }
  },
  hiddenGateways: {
    type: 'array',
    default: [],
    // Array of gateway IDs that are hidden from cycling
  },
  // Auto-update settings
  lastUpdateCheck: {
    type: 'number',
    default: 0
  },
  latestVersion: {
    type: ['string', 'null'],
    default: null
  },
  dismissedUpdateVersion: {
    type: ['string', 'null'],
    default: null
  }
};

const store = new Store({ schema });

module.exports = store;
