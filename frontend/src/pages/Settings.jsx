import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useColorMode } from '../theme/ColorMode.jsx';

const Section = ({ title, subtitle, children }) => (
  <Card variant="outlined" sx={{ mb: 3 }}>
    <CardContent>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6">{title}</Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        {children}
      </Stack>
    </CardContent>
  </Card>
);

const Row = ({ label, control, right }) => (
  <Grid container alignItems="center" spacing={2} sx={{ minHeight: 56 }}>
    <Grid item xs={12} md={4}>
      <Typography fontWeight={500}>{label}</Typography>
    </Grid>
    <Grid item xs={12} md={8} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
      {control}
      {right}
    </Grid>
  </Grid>
);

const Settings = () => {
  const { mode, setMode } = useColorMode();
  const [theme, setTheme] = useState(mode || 'light');
  useEffect(() => { setTheme(mode); }, [mode]);
  const [showSensitive, setShowSensitive] = useState(false);
  const [emailNotif, setEmailNotif] = useState(true);
  const [requestUpdates, setRequestUpdates] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [systemAlerts, setSystemAlerts] = useState(true);
  const [currency, setCurrency] = useState('USD');
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('UTC');
  const [autoLogout, setAutoLogout] = useState(true);

  const saveDisabled = useMemo(() => false, []);

  const handleExport = () => {
    // TODO: wire to backend export endpoint
    console.log('Exporting data...');
  };

  const handleDeleteAccount = () => {
    // TODO: wire to backend delete account endpoint with confirmation
    if (window.confirm('Are you sure you want to permanently delete your account? This action cannot be undone.')) {
      console.log('Account deletion requested');
    }
  };

  const handleSaveAll = () => {
    // TODO: persist settings via API
    console.log('Saving settings', {
      theme,
      showSensitive,
      emailNotif,
      requestUpdates,
      weeklyDigest,
      systemAlerts,
      currency,
      language,
      timezone,
      autoLogout,
    });
  };

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Manage your application preferences and account settings
      </Typography>

      {/* Appearance */}
      <Section title="Appearance" subtitle="Customize how the application looks and feels.">
        <List dense disablePadding>
          <ListItem divider sx={{ minHeight: 56 }} secondaryAction={
            <ListItemSecondaryAction>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip label={(mode === 'light' ? 'Light' : 'Dark')} size="small" />
                <FormControl size="small" sx={{ width: 260 }}>
                  <InputLabel id="theme-label">Theme</InputLabel>
                  <Select
                    labelId="theme-label"
                    label="Theme"
                    value={theme}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTheme(val);
                      if (val === 'system') {
                        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                        setMode(prefersDark ? 'dark' : 'light');
                      } else {
                        setMode(val);
                      }
                    }}
                  >
                    <MenuItem value="light">Light</MenuItem>
                    <MenuItem value="dark">Dark</MenuItem>
                    <MenuItem value="system">System</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </ListItemSecondaryAction>
          }>
            <ListItemText primary="Theme" />
          </ListItem>

          <ListItem sx={{ minHeight: 56 }} secondaryAction={
            <ListItemSecondaryAction>
              <Switch edge="end" checked={showSensitive} onChange={(e)=>setShowSensitive(e.target.checked)} />
            </ListItemSecondaryAction>
          }>
            <ListItemText primary="Show Sensitive Data" secondary={showSensitive ? 'Shown' : 'Hidden'} />
          </ListItem>
        </List>
      </Section>

      {/* Notifications */}
      <Section title="Notifications" subtitle="Configure how you receive notifications.">
        <List dense disablePadding>
          <ListItem divider sx={{ minHeight: 56 }} secondaryAction={
            <ListItemSecondaryAction>
              <Switch edge="end" checked={emailNotif} onChange={(e)=>setEmailNotif(e.target.checked)} />
            </ListItemSecondaryAction>
          }>
            <ListItemText primary="Email Notifications" secondary={emailNotif ? 'On' : 'Off'} />
          </ListItem>

          <ListItem divider sx={{ minHeight: 56 }} secondaryAction={
            <ListItemSecondaryAction>
              <Switch edge="end" checked={requestUpdates} onChange={(e)=>setRequestUpdates(e.target.checked)} />
            </ListItemSecondaryAction>
          }>
            <ListItemText primary="Request Updates" secondary={requestUpdates ? 'On' : 'Off'} />
          </ListItem>

          <ListItem divider sx={{ minHeight: 56 }} secondaryAction={
            <ListItemSecondaryAction>
              <Switch edge="end" checked={weeklyDigest} onChange={(e)=>setWeeklyDigest(e.target.checked)} />
            </ListItemSecondaryAction>
          }>
            <ListItemText primary="Weekly Digest" secondary={weeklyDigest ? 'On' : 'Off'} />
          </ListItem>

          <ListItem sx={{ minHeight: 56 }} secondaryAction={
            <ListItemSecondaryAction>
              <Switch edge="end" checked={systemAlerts} onChange={(e)=>setSystemAlerts(e.target.checked)} />
            </ListItemSecondaryAction>
          }>
            <ListItemText primary="System Alerts" secondary={systemAlerts ? 'On' : 'Off'} />
          </ListItem>
        </List>
      </Section>

      {/* Regional Settings */}
      <Section title="Regional Settings" subtitle="Configure your regional preferences.">
        <List dense disablePadding>
          <ListItem divider sx={{ minHeight: 56 }} secondaryAction={
            <ListItemSecondaryAction>
              <FormControl size="small" sx={{ width: 260 }}>
                <InputLabel id="currency-label">Currency</InputLabel>
                <Select
                  labelId="currency-label"
                  label="Currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <MenuItem value="USD">USD ($)</MenuItem>
                  <MenuItem value="EUR">EUR (€)</MenuItem>
                  <MenuItem value="INR">INR (₹)</MenuItem>
                  <MenuItem value="GBP">GBP (£)</MenuItem>
                </Select>
              </FormControl>
            </ListItemSecondaryAction>
          }>
            <ListItemText primary="Default Currency" />
          </ListItem>

          <ListItem divider sx={{ minHeight: 56 }} secondaryAction={
            <ListItemSecondaryAction>
              <FormControl size="small" sx={{ width: 260 }}>
                <InputLabel id="language-label">Language</InputLabel>
                <Select
                  labelId="language-label"
                  label="Language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="es">Spanish</MenuItem>
                  <MenuItem value="fr">French</MenuItem>
                  <MenuItem value="de">German</MenuItem>
                </Select>
              </FormControl>
            </ListItemSecondaryAction>
          }>
            <ListItemText primary="Language" />
          </ListItem>

          <ListItem sx={{ minHeight: 56 }} secondaryAction={
            <ListItemSecondaryAction>
              <FormControl size="small" sx={{ width: 260 }}>
                <InputLabel id="tz-label">Timezone</InputLabel>
                <Select
                  labelId="tz-label"
                  label="Timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  <MenuItem value="UTC">UTC</MenuItem>
                  <MenuItem value="IST">IST (UTC+5:30)</MenuItem>
                  <MenuItem value="PST">PST (UTC-8)</MenuItem>
                  <MenuItem value="CET">CET (UTC+1)</MenuItem>
                </Select>
              </FormControl>
            </ListItemSecondaryAction>
          }>
            <ListItemText primary="Timezone" />
          </ListItem>
        </List>
      </Section>

      {/* Security */}
      <Section title="Security" subtitle="Manage your security and privacy settings.">
        <List dense disablePadding>
          <ListItem sx={{ minHeight: 56 }} secondaryAction={
            <ListItemSecondaryAction>
              <Switch edge="end" checked={autoLogout} onChange={(e)=>setAutoLogout(e.target.checked)} />
            </ListItemSecondaryAction>
          }>
            <ListItemText primary="Auto Logout" secondary={autoLogout ? 'Enabled (30m)' : 'Disabled'} />
          </ListItem>
        </List>
        <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
          <Stack spacing={0.5}>
            <Typography fontWeight={500}>Security Status</Typography>
            <Typography variant="body2" color="text.secondary">
              Your account is secure. Last login: 10/9/2025
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Two-factor authentication enabled
            </Typography>
          </Stack>
        </Alert>
      </Section>

      {/* Data Management */}
      <Section title="Data Management" subtitle="Export or delete your data.">
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Stack spacing={2}>
                  <Typography fontWeight={600}>Export Data</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Download a copy of all your data.
                  </Typography>
                  <Button onClick={handleExport} variant="contained" startIcon={<FileDownloadIcon />}>Export</Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ borderColor: 'error.light', height: '100%' }}>
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <WarningAmberIcon color="error" />
                    <Typography fontWeight={600} color="error.main">Danger Zone</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    The following actions are irreversible.
                  </Typography>
                  <Button color="error" variant="contained" startIcon={<DeleteForeverIcon />} onClick={handleDeleteAccount}>
                    Delete Account
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Section>

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="flex-end" sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={saveDisabled}
          onClick={handleSaveAll}
        >
          Save All Settings
        </Button>
      </Stack>

      {/* System Information */}
      <Section title="System Information">
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">Version</Typography>
            <Typography fontWeight={600}>v1.0.0</Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">Environment</Typography>
            <Chip size="small" label="Development" color="primary" variant="outlined" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">Last Updated</Typography>
            <Typography fontWeight={600}>10/9/2025</Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">Support</Typography>
            <Typography fontWeight={600}>support@company.com</Typography>
          </Grid>
        </Grid>
      </Section>
    </Box>
  );
};

export default Settings;
