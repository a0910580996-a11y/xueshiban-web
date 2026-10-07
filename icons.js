const paths = {
  homework: '<rect x="5" y="4.5" width="14" height="16" rx="2.5"/><path d="M9 4.5v-.6c0-.8.6-1.4 1.4-1.4h3.2c.8 0 1.4.6 1.4 1.4v.6"/><path d="M8.8 12.6l2.3 2.3 4.2-4.4"/>',
  notice: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5l1.5-1.5z"/><path d="M10 20.5h4"/>',
  library: '<path d="M12 6.6C10.2 5.2 7.7 4.5 4.5 4.5v13c3.2 0 5.7.7 7.5 2 1.8-1.3 4.3-2 7.5-2v-13c-3.2 0-5.7.7-7.5 2.1z"/><path d="M12 6.6v12.9"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  check: '<path d="M5.5 12.5l4.2 4.2L18.5 8"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  'chevron-right': '<path d="M9.5 6l6 6-6 6"/>',
  'chevron-down': '<path d="M6.5 9.5l5.5 5.5 5.5-5.5"/>',
  external: '<path d="M8 16l8.5-8.5M9.5 7.5h7v7"/>',
  download: '<path d="M12 4.5v10.5M7.5 10.5l4.5 4.5 4.5-4.5M5 19.5h14"/>',
  share: '<path d="M12 14.5V3.5M8 7.5l4-4 4 4"/><path d="M8 10.5H6.5a1.5 1.5 0 0 0-1.5 1.5v7a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5H16"/>',
  users: '<circle cx="9.5" cy="8.5" r="3.2"/><path d="M3.8 19c.6-3.1 2.9-4.8 5.7-4.8s5.1 1.7 5.7 4.8"/><path d="M15.8 5.6a3.2 3.2 0 0 1 0 5.8M17.6 14.4c1.6.6 2.6 2 3 4.6"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  file: '<path d="M7 3.5h7l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z"/><path d="M13.5 3.5V8h5"/>',
  inbox: '<path d="M4 13.5L6.6 6A1.5 1.5 0 0 1 8 5h8a1.5 1.5 0 0 1 1.4 1L20 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z"/><path d="M4 13.5h4.5l1.2 2h4.6l1.2-2H20"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.3-5.4"/><path d="M19.5 4.5v4h-4"/>',
  sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v1.8M12 19.2V21M3 12h1.8M19.2 12H21M5.6 5.6l1.3 1.3M17.1 17.1l1.3 1.3M5.6 18.4l1.3-1.3M17.1 6.9l1.3-1.3"/>',
  moon: '<path d="M19.5 14.6A7.5 7.5 0 0 1 9.4 4.5a7.5 7.5 0 1 0 10.1 10.1z"/>',
  auto: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  alert: '<path d="M10.7 4.6L3.4 17.5A1.5 1.5 0 0 0 4.7 19.7h14.6a1.5 1.5 0 0 0 1.3-2.2L13.3 4.6a1.5 1.5 0 0 0-2.6 0z"/><path d="M12 9.5v4M12 16.6v.1"/>',
  link: '<path d="M10.5 13.5a3.8 3.8 0 0 0 5.4 0l2.7-2.7a3.8 3.8 0 0 0-5.4-5.4l-.9.9"/><path d="M13.5 10.5a3.8 3.8 0 0 0-5.4 0l-2.7 2.7a3.8 3.8 0 0 0 5.4 5.4l.9-.9"/>'
}

export const ICON_NAMES = Object.keys(paths)
export function icon(name, className = '') {
  if (!Object.hasOwn(paths, name)) return ''
  return `<svg class="icon${className ? ' ' + className : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`
}
