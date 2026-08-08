import type { ConferenceDefinition } from './domain'

export const UNIVERSE_V0_CONFERENCES = [
  {
    id: 'atlantic-foundry',
    name: 'Atlantic Foundry Conference',
    identity:
      'Northeast and Mid-Atlantic collection of established private, public, technical, and urban institutions.',
  },
  {
    id: 'lakes-union',
    name: 'Lakes Union Conference',
    identity:
      'Great Lakes and upper-Midwest league with the deepest traditional basketball hierarchy.',
  },
  {
    id: 'southern-crescent',
    name: 'Southern Crescent Conference',
    identity:
      'Southeast and Gulf-region league combining established contenders with several high-upside rebuilds.',
  },
  {
    id: 'western-horizon',
    name: 'Western Horizon Conference',
    identity:
      'Mountain, desert, and Pacific programs with newer powers and broad geographic variety.',
  },
] as const satisfies readonly ConferenceDefinition[]
