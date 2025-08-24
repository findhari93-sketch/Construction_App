'use client'
import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1c5b7a' },
    secondary: { main: '#f59e0b' },
    background: { default: '#f7f7f7' },
  },
  typography: { fontSize: 14 },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', height: 40 } } },
    MuiTooltip: { styleOverrides: { tooltip: { fontSize: '12px !important' } } },
  },
})