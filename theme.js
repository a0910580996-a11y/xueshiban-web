// Runs before first paint so a saved light/dark preference never flashes the wrong theme.
try {
  const theme = JSON.parse(localStorage.getItem('xueshiban:theme'))
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme
} catch {}
