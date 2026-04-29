import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Divider,
  useTheme,
} from '@mui/material';
import PlaylistAddCheckCircleIcon from '@mui/icons-material/PlaylistAddCheckCircle';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import axiosClient from '../api/axiosClient';
import { useRegionalSettings } from '../hooks/useRegionalSettings';

const StatCard = ({ icon, label, value, deltaText, deltaColor = 'success' }) => (
  <Card
    variant="outlined"
    sx={{
      height: '100%',
      borderRadius: 2,
      borderColor: 'divider',
      background: (theme) => theme.palette.mode === 'light'
        ? 'linear-gradient(135deg, rgba(25,118,210,0.03) 0%, rgba(255,255,255,0.8) 100%)'
        : 'linear-gradient(135deg, rgba(25,118,210,0.1) 0%, rgba(255,255,255,0.02) 100%)',
      boxShadow: (theme) => theme.palette.mode === 'light' 
        ? '0 2px 8px rgba(0,0,0,0.08)' 
        : '0 2px 8px rgba(0,0,0,0.4)',
      transition: 'all 0.3s ease',
      '&:hover': {
        boxShadow: (theme) => theme.palette.mode === 'light'
          ? '0 4px 16px rgba(0,0,0,0.12)'
          : '0 4px 16px rgba(0,0,0,0.6)',
        transform: 'translateY(-2px)',
      }
    }}
  >
    <CardContent sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ fontSize: '0.8125rem' }}>
          {label}
        </Typography>
        <Box sx={(theme)=>({
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 2,
          bgcolor: theme.palette.mode === 'light' ? 'rgba(25,118,210,0.08)' : 'rgba(25,118,210,0.15)',
        })}>
          {React.cloneElement(icon, { sx: { fontSize: 24 } })}
        </Box>
      </Box>
      <Box>
        <Box sx={{ minHeight: 60, display: 'flex', alignItems: 'center' }}>
          {typeof value === 'string' || typeof value === 'number' ? (
            <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.2 }}>
              {value}
            </Typography>
          ) : (
            value
          )}
        </Box>
        {deltaText && (
          <Typography variant="caption" sx={{ color: `${deltaColor}.main`, fontWeight: 600, mt: 0.5, display: 'block' }}>
            {deltaText}
          </Typography>
        )}
      </Box>
    </CardContent>
  </Card>
);

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const Dashboard = () => {
  const [rows, setRows] = useState([]);
  const [travelCostSummary, setTravelCostSummary] = useState(null);
  const { currency, formatCurrency } = useRegionalSettings();

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        // Fetch all requests without pagination for dashboard charts
        const { data } = await axiosClient.get('/requests', { 
          signal: controller.signal,
          params: { limit: 10000 }
        });
        setRows(Array.isArray(data?.data || data) ? (data.data || data) : []);
      } catch (e) {
        setRows([]);
      }
    })();

    // Fetch travel cost summary for cancellation charges
    (async () => {
      try {
        const { data } = await axiosClient.get('/travel-costs/summary');
        setTravelCostSummary(data?.data || null);
      } catch (e) {
        setTravelCostSummary(null);
      }
    })();

    return () => controller.abort();
  }, []);

  const stats = useMemo(() => {
    const totalRequests = rows.length;
    const pending = rows.filter(r => String(r.status).toLowerCase() === 'pending').length;
    
    // Group amounts by currency
    const byCurrency = {};
    rows.forEach(r => {
      const curr = r.currency || 'USD';
      if (!byCurrency[curr]) {
        byCurrency[curr] = { total: 0, thisMonth: 0 };
      }
      byCurrency[curr].total += Number(r.amount || 0);
    });

    // This month amounts by currency
    const now = new Date();
    rows
      .filter(r => r.date && (new Date(r.date)).getMonth() === now.getMonth() && (new Date(r.date)).getFullYear() === now.getFullYear())
      .forEach(r => {
        const curr = r.currency || 'USD';
        if (!byCurrency[curr]) {
          byCurrency[curr] = { total: 0, thisMonth: 0 };
        }
        byCurrency[curr].thisMonth += Number(r.amount || 0);
      });

    return { totalRequests, pending, byCurrency };
  }, [rows]);

  const monthlySeries = useMemo(() => {
    // Sum by month for current year, handling multiple currencies
    const byMonth = new Array(12).fill(0);
    const year = new Date().getFullYear();
    
    rows.forEach(r => {
      const d = r.date ? new Date(r.date) : null;
      if (d && d.getFullYear() === year) {
        // Store amount in original currency - no conversion
        byMonth[d.getMonth()] += Number(r.amount || 0);
      }
    });
    return byMonth;
  }, [rows]);

  const categorySeries = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      const key = r.category || 'Other';
      map.set(key, (map.get(key) || 0) + Number(r.amount || 0));
    });

    // Add cancellation charges from travel costs summary as a dedicated slice
    const cancellationTotal = parseFloat(travelCostSummary?.total_cancellation || 0);
    if (cancellationTotal > 0) {
      const existing = map.get('Cancellation Charges') || 0;
      map.set('Cancellation Charges', existing + cancellationTotal);
    }

    const total = Array.from(map.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1]) // largest slice first
      .map(([name, value]) => ({ name, value, pct: (value / total) * 100 }));
  }, [rows, travelCostSummary]);

  // Enhanced SVG line chart with live data features
  const LineChart = ({ data, width=520, height=260, stroke='#1976d2' }) => {
    const theme = useTheme();
    const max = Math.max(...data, 1);
    const pad = 40; // Increased padding for better labels
    const w = width - pad*2;
    const h = height - pad*2;
    
    // Generate points for the line
    const points = data.map((v,i)=>{
      const x = pad + (i*(w/(data.length-1 || 1)));
      const y = pad + (h - (v/max)*h);
      return `${x},${y}`;
    }).join(' ');
    
    // Generate points for area fill
    const areaPoints = points + ` ${pad + w},${height - pad} ${pad},${height - pad}`;
    
    const bg = theme.palette.mode === 'dark' ? theme.palette.background.paper : '#fff';
    const axis = theme.palette.divider;
    const grid = theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
    const gradientId = 'chart-gradient';
    
    return (
      <svg width={width} height={height} role="img" aria-label="Monthly Trends">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={width} height={height} fill={bg} stroke={axis} />
        
        {/* Grid lines */}
        {[0,0.25,0.5,0.75,1].map((t,idx)=>{
          const y = pad + (h*(1-t));
          return (
            <g key={idx}>
              <line x1={pad} y1={y} x2={width-pad} y2={y} stroke={grid} strokeDasharray="2,2" />
              <text x={pad-5} y={y+3} textAnchor="end" fill={theme.palette.text.secondary} fontSize="10">
                {Math.round(max * t)}
              </text>
            </g>
          );
        })}
        
        {/* Area fill under the line */}
        <polygon 
          points={areaPoints} 
          fill={`url(#${gradientId})`}
          opacity={0.8}
        />
        
        {/* Main line */}
        <polyline 
          fill="none" 
          stroke={stroke} 
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points} 
        />
        
        {/* Data points with hover effect */}
        {data.map((v,i)=>{
          const x = pad + (i*(w/(data.length-1 || 1)));
          const y = pad + (h - (v/Math.max(max,1))*h);
          const hasData = v > 0;
          
          return (
            <g key={i}>
              {/* Outer glow for data points */}
              {hasData && (
                <circle 
                  cx={x} 
                  cy={y} 
                  r={6} 
                  fill={stroke} 
                  opacity={0.2}
                />
              )}
              {/* Main data point */}
              <circle 
                cx={x} 
                cy={y} 
                r={hasData ? 4 : 2} 
                fill={hasData ? stroke : theme.palette.text.disabled}
                stroke={bg}
                strokeWidth={2}
              />
              {/* Value label for non-zero points */}
              {hasData && (
                <text 
                  x={x} 
                  y={y-10} 
                  textAnchor="middle" 
                  fill={stroke} 
                  fontSize="10" 
                  fontWeight="600"
                >
                  {Math.round(v)}
                </text>
              )}
            </g>
          );
        })}
        
        {/* Axes */}
        <line x1={pad} y1={pad} x2={pad} y2={height-pad} stroke={axis} strokeWidth={2} />
        <line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} stroke={axis} strokeWidth={2} />
      </svg>
    );
  };

  const PieChart = ({ series, width=360, height=260 }) => {
    const theme = useTheme();
    const cx = width/2, cy = height/2, r = Math.min(width,height)/3;
    let startAngle = -Math.PI/2;
    // Enhanced color palette with better contrast and visual appeal
    const colors = [
      '#1976d2', // Blue
      '#2e7d32', // Green
      '#ed6c02', // Orange
      '#9c27b0', // Purple
      '#607d8b', // Blue Grey
      '#ef5350', // Red
      '#00acc1', // Cyan
      '#7cb342', // Light Green
      '#f57c00', // Deep Orange
      '#5e35b1', // Deep Purple
    ];
    const arcs = series.map((s,idx)=>{
      const angle = (s.pct/100)*2*Math.PI;
      const endAngle = startAngle + angle;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = angle > Math.PI ? 1 : 0;
      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      const path = <path key={idx} d={d} fill={colors[idx % colors.length]} stroke="#fff" strokeWidth={1} />;
      startAngle = endAngle;
      return path;
    });
    const bg = theme.palette.mode === 'dark' ? theme.palette.background.paper : '#fff';
    const axis = theme.palette.divider;
    return (
      <svg width={width} height={height} role="img" aria-label="Category Breakdown">
        <rect x={0} y={0} width={width} height={height} fill={bg} stroke={axis} />
        {arcs}
      </svg>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 1400, mx: 'auto', width: '100%' }}>
      {/* Welcome */}
      <Box>
        <Typography variant="h4" fontWeight={800}>Welcome back, Admin!</Typography>
        <Typography variant="body2" color="text.secondary">Here's your PocketPro HR overview for today.</Typography>
      </Box>

      {/* Stats */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          alignItems: 'stretch',
        }}
      >
        <StatCard 
          icon={<PlaylistAddCheckCircleIcon color="primary" />} 
          label="Total Requests" 
          value={stats.totalRequests} 
        />
        <StatCard 
          icon={<AccessTimeOutlinedIcon color="warning" />} 
          label="Pending Approval" 
          value={stats.pending} 
        />
        <StatCard 
          icon={<AccountBalanceWalletIcon color="success" />} 
          label="Total Amount" 
          value={
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {Object.entries(stats.byCurrency).map(([curr, data]) => (
                <Box key={curr} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                  <Typography variant="h6" component="span" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                    {formatCurrency(data.total, curr)}
                  </Typography>
                  <Typography variant="caption" component="span" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.7rem' }}>
                    {curr}
                  </Typography>
                </Box>
              ))}
              {Object.keys(stats.byCurrency).length === 0 && (
                <Typography variant="h6" fontWeight={700}>
                  {formatCurrency(0, currency)}
                </Typography>
              )}
            </Box>
          }
        />
        <StatCard 
          icon={<TrendingUpIcon color="secondary" />} 
          label="This Month" 
          value={
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {Object.entries(stats.byCurrency).map(([curr, data]) => (
                data.thisMonth > 0 && (
                  <Box key={curr} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                    <Typography variant="h6" component="span" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                      {formatCurrency(data.thisMonth, curr)}
                    </Typography>
                    <Typography variant="caption" component="span" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.7rem' }}>
                      {curr}
                    </Typography>
                  </Box>
                )
              ))}
              {Object.values(stats.byCurrency).every(d => d.thisMonth === 0) && (
                <Typography variant="h6" fontWeight={700}>
                  {formatCurrency(0, currency)}
                </Typography>
              )}
            </Box>
          }
        />
      </Box>

      {/* Charts */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={7}>
          <Card variant="outlined" sx={{ borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={800} gutterBottom>Monthly Trends</Typography>
                  <Typography variant="body2" color="text.secondary">Requests and amounts over time (Mixed Currencies)</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box 
                    sx={{ 
                      width: 8, 
                      height: 8, 
                      borderRadius: '50%',
                      backgroundColor: '#4caf50',
                      animation: 'pulse 2s infinite'
                    }} 
                  />
                  <Typography variant="caption" color="success.main" fontWeight={600}>
                    Live Data
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center', mb: 2 }}>
                <LineChart data={monthlySeries} />
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, mx: 4 }}>
                {months.map((m,i)=> {
                  const hasData = monthlySeries[i] > 0;
                  return (
                    <Box key={i} sx={{ textAlign: 'center' }}>
                      <Typography 
                        variant="caption" 
                        color={hasData ? 'text.primary' : 'text.disabled'}
                        sx={{ 
                          fontWeight: hasData ? 600 : 400,
                          display: 'block'
                        }}
                      >
                        {m}
                      </Typography>
                      {hasData && (
                        <Typography 
                          variant="caption" 
                          color="primary.main"
                          sx={{ fontSize: '0.7rem', fontWeight: 500 }}
                        >
                          {Math.round(monthlySeries[i])}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={800} gutterBottom>Category Breakdown</Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>Expenses by category this month</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
                <PieChart series={categorySeries} />
                <Box sx={{ display: 'grid', gap: 1, maxHeight: 300, overflowY: 'auto' }}>
                  {categorySeries.map((c, idx) => {
                    const colors = [
                      '#1976d2', // Blue
                      '#2e7d32', // Green
                      '#ed6c02', // Orange
                      '#9c27b0', // Purple
                      '#607d8b', // Blue Grey
                      '#ef5350', // Red
                      '#00acc1', // Cyan
                      '#7cb342', // Light Green
                      '#f57c00', // Deep Orange
                      '#5e35b1', // Deep Purple
                    ];
                    return (
                      <Box 
                        key={c.name+idx}
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 1,
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          border: `1px solid ${colors[idx % colors.length]}20`,
                          backgroundColor: `${colors[idx % colors.length]}08`
                        }}
                      >
                        <Box 
                          sx={{ 
                            width: 8, 
                            height: 8, 
                            borderRadius: '50%',
                            backgroundColor: colors[idx % colors.length],
                            flexShrink: 0
                          }} 
                        />
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: colors[idx % colors.length],
                            fontWeight: 500,
                            fontSize: '0.8125rem'
                          }}
                        >
                          {c.name} {Math.round(c.pct)}%
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Currency Breakdown Card */}
        <Grid item xs={12}>
          <Card variant="outlined" sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ mb: 2.5 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ fontSize: '1.125rem' }}>
                  Currency Breakdown
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                  Total amounts by currency
                </Typography>
              </Box>
              <Grid container spacing={2.5}>
                {Object.entries(stats.byCurrency).map(([curr, data]) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={curr}>
                    <Card 
                      variant="outlined" 
                      sx={{ 
                        p: 2.5, 
                        borderRadius: 2,
                        borderColor: 'primary.main',
                        borderWidth: 1.5,
                        background: (theme) => theme.palette.mode === 'light'
                          ? 'linear-gradient(135deg, rgba(25,118,210,0.04) 0%, rgba(25,118,210,0.01) 100%)'
                          : 'linear-gradient(135deg, rgba(25,118,210,0.12) 0%, rgba(25,118,210,0.04) 100%)',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          borderColor: 'primary.dark',
                          boxShadow: '0 4px 12px rgba(25,118,210,0.15)',
                          transform: 'translateY(-2px)',
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h4" fontWeight={800} color="primary.main" sx={{ fontSize: '2rem' }}>
                          {curr}
                        </Typography>
                        <Chip 
                          label={`${rows.filter(r => r.currency === curr).length} req`} 
                          size="small" 
                          color="primary" 
                          variant="outlined"
                          sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                        />
                      </Box>
                      <Divider sx={{ my: 1.5 }} />
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontSize: '0.75rem', fontWeight: 500 }}>
                          Total Amount
                        </Typography>
                        <Typography variant="h5" fontWeight={700} color="success.main" sx={{ fontSize: '1.5rem' }}>
                          {formatCurrency(data.total, curr)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontSize: '0.75rem', fontWeight: 500 }}>
                          This Month
                        </Typography>
                        <Typography variant="h6" fontWeight={600} color="secondary.main" sx={{ fontSize: '1.125rem' }}>
                          {formatCurrency(data.thisMonth, curr)}
                        </Typography>
                      </Box>
                    </Card>
                  </Grid>
                ))}
                {Object.keys(stats.byCurrency).length === 0 && (
                  <Grid item xs={12}>
                    <Box sx={{ textAlign: 'center', py: 6 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                        No data available yet. Start by creating some requests!
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
