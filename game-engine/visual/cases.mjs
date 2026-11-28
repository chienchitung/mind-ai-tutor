/** The pictures taken of every template's game home. */
export const TEMPLATES = ['discovery', 'neo-brutal', 'arcade', 'forest-camp', 'arcane-archive', 'orbital-lab']

const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  phone: { width: 390, height: 844 },
}

export const CASES = TEMPLATES.flatMap(template => [
  { name: `${template}-island-desktop`, template, view: 'island', viewport: VIEWPORTS.desktop, selector: '.island-stage', webgl: true },
  { name: `${template}-island-phone`, template, view: 'island', viewport: VIEWPORTS.phone, selector: '.island-stage', webgl: true },
  { name: `${template}-route-desktop`, template, view: 'route', viewport: VIEWPORTS.desktop, selector: '#mission-map', webgl: false },
])
