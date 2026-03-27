import { useState, useEffect, useCallback } from 'react';
import axiosClient from '../api/axiosClient';
import {
  Box, Typography, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, Chip,
  InputAdornment, TextField, CircularProgress,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Search, FileDownload, TrendingUp,
  FlightTakeoff, Hotel, Restaurant, LocalParking,
  Luggage, DirectionsCar, ReceiptLong,
} from '@mui/icons-material';

const COST_COLS = [
  { key: 'flight_cost',    label: 'Flight',     color: '#3B82F6' },
  { key: 'hotel_cost',     label: 'Hotel',      color: '#6366F1' },
  { key: 'food_cost',      label: 'Food',       color: '#10B981' },
  { key: 'car_park_cost',  label: 'Car Park',   color: '#6B7280' },
  { key: 'visa_cost',      label: 'Visa',       color: '#F59E0B' },
  { key: 'baggage_cost',   label: 'Baggage',    color: '#8B5CF6' },
  { key: 'transport_cost', label: 'Transport',  color: '#EC4899' },
  { key: 'other_cost',     label: 'Other',      color: '#9CA3AF' },
];

const fmt = (val, currency = 'GBP') => {
  const n = parseFloat(val);
  if (!n) return <span style={{ color: '#d1d5db' }}>—</span>;
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(n); }
  catch { return `${currency} ${n.toFixed(2)}`; }
};

export default function TravelCostAudit() {
  const [rows, setSummaryRows] = useState([]);
  const [summary, setSummary]  = useState(null);
  const [loading, setLoading]  = useState(true);
  const [search, setSearch]    = useState('');
  const [fromDate, setFromDate]= useState('');
  const [toDate, setToDate]    = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (fromDate) params.from = fromDate;
      if (toDate)   params.to   = toDate;
      const [costsRes, summaryRes] = await Promise.all([
        axiosClient.get('/travel-costs', { params }),
        axiosClient.get('/travel-costs/summary', { params }),
      ]);
      setSummaryRows(costsRes.data?.data || []);
      setSummary(summaryRes.data?.data || null);
    } catch (err) {
      console.error('Failed to fetch costs:', err);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = rows.filter(r =>
    !search || [r.employee_name, r.employee_email, r.trip_summary]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  const exportCSV = () => {
    const headers = ['Request ID','Employee','Trip','Date','Currency',
      'Flight','Hotel','Food','Car Park','Visa','Baggage','Transport','Other','Total'];
    const csvRows = filtered.map(r => [
      r.request_id, r.employee_name, r.trip_summary, r.travel_date?.split('T')[0]||'',
      r.currency, r.flight_cost||0, r.hotel_cost||0, r.food_cost||0, r.car_park_cost||0,
      r.visa_cost||0, r.baggage_cost||0, r.transport_cost||0, r.other_cost||0, r.total_cost||0,
    ]);
    const csv = [headers,...csvRows].map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='travel_cost_audit.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', mb:3, flexWrap:'wrap', gap:2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Travel Cost Audit</Typography>
          <Typography variant="body2" color="text.secondary">
            Read-only report of all travel expenses — auto-populated when admin uploads travel details
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<FileDownload />} onClick={exportCSV} disabled={!filtered.length}>
          Export CSV
        </Button>
      </Box>

      {/* Summary Cards */}
      {summary && (
        <Box sx={{ display:'grid', gap:2, mb:3, gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))' }}>
          {[
            { label:'Total Trips',  value: summary.total_requests || 0,  icon:<ReceiptLong />,   color:'#3B82F6' },
            { label:'Grand Total',  value: fmt(summary.grand_total),      icon:<TrendingUp />,    color:'#10B981' },
            { label:'Flights',      value: fmt(summary.total_flights),    icon:<FlightTakeoff />, color:'#3B82F6' },
            { label:'Hotel',        value: fmt(summary.total_hotel),      icon:<Hotel />,         color:'#6366F1' },
            { label:'Food',         value: fmt(summary.total_food),       icon:<Restaurant />,    color:'#10B981' },
            { label:'Car Park',     value: fmt(summary.total_car_park),   icon:<LocalParking />,  color:'#6B7280' },
            { label:'Visa',         value: fmt(summary.total_visa),       icon:<ReceiptLong />,   color:'#F59E0B' },
            { label:'Baggage+',     value: fmt(parseFloat(summary.total_baggage||0)+parseFloat(summary.total_transport||0)+parseFloat(summary.total_other||0)), icon:<Luggage />, color:'#8B5CF6' },
          ].map(c => (
            <Card key={c.label} variant="outlined" sx={{ borderRadius:2 }}>
              <CardContent sx={{ display:'flex', alignItems:'center', gap:1.5, p:'12px !important' }}>
                <Box sx={{ bgcolor: alpha(c.color, 0.12), color: c.color, borderRadius:1, p:0.75, display:'flex' }}>
                  {c.icon}
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display:'block', lineHeight:1.2 }}>{c.label}</Typography>
                  <Typography variant="subtitle2" fontWeight={700}>{c.value}</Typography>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Filters */}
      <Card variant="outlined" sx={{ mb:2, borderRadius:2 }}>
        <CardContent sx={{ display:'flex', gap:2, flexWrap:'wrap', alignItems:'center', py:'10px !important' }}>
          <TextField size="small" placeholder="Search employee or trip..."
            value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
            sx={{ minWidth:260 }} />
          <TextField size="small" label="From" type="date" value={fromDate}
            onChange={e => setFromDate(e.target.value)} InputLabelProps={{ shrink:true }} />
          <TextField size="small" label="To" type="date" value={toDate}
            onChange={e => setToDate(e.target.value)} InputLabelProps={{ shrink:true }} />
          {(fromDate || toDate) && (
            <Button size="small" onClick={() => { setFromDate(''); setToDate(''); }}>Clear</Button>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ ml:'auto' }}>
            {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          </Typography>
        </CardContent>
      </Card>

      {/* Table */}
      <Card variant="outlined" sx={{ borderRadius:2 }}>
        <CardContent sx={{ p:0 }}>
          {loading ? (
            <Box sx={{ display:'flex', justifyContent:'center', py:8 }}><CircularProgress /></Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ textAlign:'center', py:8 }}>
              <ReceiptLong sx={{ fontSize:48, color:'text.disabled', mb:1 }} />
              <Typography color="text.secondary">No cost records yet.</Typography>
              <Typography variant="caption" color="text.disabled">
                Costs are automatically saved when admin uploads travel details.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor:'action.hover' }}>
                    <TableCell sx={{ fontWeight:700 }}>Request</TableCell>
                    <TableCell sx={{ fontWeight:700 }}>Employee</TableCell>
                    <TableCell sx={{ fontWeight:700 }}>Trip</TableCell>
                    <TableCell sx={{ fontWeight:700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight:700 }}>Currency</TableCell>
                    {COST_COLS.map(c => (
                      <TableCell key={c.key} align="right" sx={{ fontWeight:700, color:c.color }}>{c.label}</TableCell>
                    ))}
                    <TableCell align="right" sx={{ fontWeight:700, color:'primary.main' }}>Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(row => (
                    <TableRow key={row.id} hover>
                      <TableCell>
                        <Chip label={`#${row.request_id}`} size="small" color="primary" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{row.employee_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.employee_email}</Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth:160 }}>
                        <Typography variant="body2" noWrap title={row.trip_summary}>{row.trip_summary}</Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace:'nowrap' }}>
                        {row.travel_date ? new Date(row.travel_date).toLocaleDateString('en-GB') : '—'}
                      </TableCell>
                      <TableCell>
                        <Chip label={row.currency || 'GBP'} size="small" variant="outlined" />
                      </TableCell>
                      {COST_COLS.map(c => (
                        <TableCell key={c.key} align="right">
                          <Typography variant="body2">{fmt(row[c.key], row.currency)}</Typography>
                        </TableCell>
                      ))}
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={700} color="primary.main">
                          {fmt(row.total_cost, row.currency)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
