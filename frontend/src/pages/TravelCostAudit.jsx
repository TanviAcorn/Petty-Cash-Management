import { useState, useEffect, useCallback } from 'react';
import axiosClient, { getFileUrl } from '../api/axiosClient';
import AttachmentButton from '../components/AttachmentButton';
import {
  Box, Typography, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, Chip,
  InputAdornment, TextField, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, Divider, Tooltip, LinearProgress,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Search, FileDownload, TrendingUp,
  FlightTakeoff, Hotel, Restaurant, LocalParking,
  Luggage, DirectionsCar, ReceiptLong, OpenInNew, InsertDriveFile, Close,
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

// Maps cost column key → doc_type tag used when uploading
const COST_TO_DOC_TYPE = {
  flight_cost:    'flights',
  hotel_cost:     'hotel',
  food_cost:      'food',
  car_park_cost:  'carPark',
  visa_cost:      'visa',
  baggage_cost:   'baggage',
  transport_cost: 'rentedVehicle',
};

export default function TravelCostAudit() {
  const [rows, setSummaryRows] = useState([]);
  const [summary, setSummary]  = useState(null);
  const [loading, setLoading]  = useState(true);
  const [search, setSearch]    = useState('');
  const [fromDate, setFromDate]= useState('');
  const [toDate, setToDate]    = useState('');

  // Request detail modal
  const [reqModal, setReqModal]       = useState(null);   // full request object
  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [reqLoading, setReqLoading]   = useState(false);

  // Doc viewer modal
  const [docModal, setDocModal]       = useState(null);   // { costKey, label, docs[] }
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docLoading, setDocLoading]   = useState(false);

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

  const openRequestModal = async (requestId) => {
    setReqLoading(true);
    setReqModalOpen(true);
    setReqModal(null);
    try {
      const res = await axiosClient.get(`/l1-approvals/${requestId}`);
      setReqModal(res.data?.data || null);
    } catch (err) {
      console.error('Failed to fetch request:', err);
    } finally {
      setReqLoading(false);
    }
  };

  const openDocModal = async (row, costKey, label) => {
    setDocLoading(true);
    setDocModalOpen(true);
    setDocModal({ costKey, label, docs: [] });
    try {
      const [docsRes, draftRes] = await Promise.all([
        axiosClient.get(`/travel-documents/${row.request_id}`),
        axiosClient.get(`/travel-documents/${row.request_id}/draft`),
      ]);
      const allDocs = docsRes.data?.data || [];
      const docType = COST_TO_DOC_TYPE[costKey];
      // Filter docs matching this section; if none tagged, show all
      const filtered = allDocs.filter(d => d.doc_type === docType);
      const docs = filtered.length ? filtered : allDocs;

      // Also pull the text details for this section from draft
      const draft = draftRes.data?.data;
      const sectionDetails = draft?.details?.[docType] || {};

      setDocModal({ costKey, label, docs, sectionDetails, requestId: row.request_id });
    } catch (err) {
      console.error('Failed to fetch docs:', err);
    } finally {
      setDocLoading(false);
    }
  };

  const filtered = rows.filter(r =>
    !search || [r.employee_name, r.employee_email, r.trip_summary]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  const exportCSV = async () => {
    try {
      // Fetch ALL records matching current date filter (no client-side pagination limit)
      const params = {};
      if (fromDate) params.from = fromDate;
      if (toDate)   params.to   = toDate;

      const res = await axiosClient.get('/travel-costs', { params });
      const allRows = res.data?.data || [];

      // Apply search filter client-side (same as the table)
      const exportRows = allRows.filter(r =>
        !search || [r.employee_name, r.employee_email, r.trip_summary]
          .some(v => v?.toLowerCase().includes(search.toLowerCase()))
      );

      const headers = ['Request ID', 'Employee', 'Email', 'Trip', 'Date', 'Currency',
        'Flight', 'Hotel', 'Food', 'Car Park', 'Visa', 'Baggage', 'Transport', 'Other', 'Total'];
      const csvRows = exportRows.map(r => [
        r.request_id,
        `"${(r.employee_name || '').replace(/"/g, '""')}"`,
        `"${(r.employee_email || '').replace(/"/g, '""')}"`,
        `"${(r.trip_summary || '').replace(/"/g, '""')}"`,
        r.travel_date?.split('T')[0] || '',
        r.currency || 'GBP',
        r.flight_cost    || 0,
        r.hotel_cost     || 0,
        r.food_cost      || 0,
        r.car_park_cost  || 0,
        r.visa_cost      || 0,
        r.baggage_cost   || 0,
        r.transport_cost || 0,
        r.other_cost     || 0,
        r.total_cost     || 0,
      ]);

      const csv = [headers, ...csvRows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
      const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Build filename with date range if set
      let filename = 'travel_cost_audit';
      if (fromDate || toDate) {
        filename = `travel_cost_audit_${fromDate || 'start'}_to_${toDate || 'end'}`;
      }
      a.download = `${filename}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
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
                        <Chip
                          label={`#${row.request_id}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                          onClick={() => openRequestModal(row.request_id)}
                          icon={<OpenInNew sx={{ fontSize: '13px !important' }} />}
                          sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'primary.50' } }}
                        />
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
                          {parseFloat(row[c.key]) ? (
                            <Tooltip title={`View ${c.label} documents`} arrow>
                              <Typography
                                variant="body2"
                                onClick={() => openDocModal(row, c.key, c.label)}
                                sx={{ cursor: 'pointer', color: c.color, fontWeight: 600, textDecoration: 'underline dotted', '&:hover': { opacity: 0.75 } }}
                              >
                                {fmt(row[c.key], row.currency)}
                              </Typography>
                            </Tooltip>
                          ) : (
                            <Typography variant="body2">{fmt(row[c.key], row.currency)}</Typography>
                          )}
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

      {/* ── Request Detail Modal ─────────────────────────────────────────── */}
      <Dialog open={reqModalOpen} onClose={() => setReqModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReceiptLong color="primary" />
            <Typography variant="h6" fontWeight={700}>
              Request #{reqModal?.id} — {reqModal?.employee_name}
            </Typography>
          </Box>
          <Button size="small" onClick={() => setReqModalOpen(false)} startIcon={<Close />}>Close</Button>
        </DialogTitle>
        <DialogContent dividers>
          {reqLoading ? (
            <Box sx={{ py: 4 }}><LinearProgress /></Box>
          ) : reqModal ? (
            <Box>
              {/* Employee info */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
                {[
                  ['Employee', reqModal.employee_name],
                  ['Email', reqModal.employee_email],
                  ['Company', reqModal.company_name],
                  ['Status', reqModal.status],
                  ['L1 Status', reqModal.l1_approval_status],
                  ['Submitted', reqModal.created_at ? new Date(reqModal.created_at).toLocaleDateString('en-GB') : '—'],
                ].map(([label, value]) => (
                  <Box key={label} sx={{ bgcolor: 'grey.50', borderRadius: 1, px: 2, py: 1.5 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>{label}</Typography>
                    <Typography variant="body2" fontWeight={500}>{value || '—'}</Typography>
                  </Box>
                ))}
              </Box>
              <Divider sx={{ mb: 2 }} />
              {/* Travel form data */}
              {(() => {
                // Backend already parses travel_form_data — no need to JSON.parse again
                const td = reqModal.travel_form_data || null;
                if (!td) return null;
                const fields = [
                  ['Travel Type',        td.travelType],
                  ['Trip Type',          td.tripType],
                  ['Country',            td.countryOfTravel],
                  ['Departure Airport',  td.preferredDepartureAirport],
                  ['Destination Airport',td.destinationAirport],
                  ['Nationality',        td.nationality],
                  ['Visa Type',          td.visaType],
                  ['From City',          td.roundTrip?.fromCity],
                  ['To City',            td.roundTrip?.toCity],
                  ['Departure Date',     td.roundTrip?.departureDate],
                  ['Return Date',        td.roundTrip?.arrivalDate],
                  ['City (Domestic)',    td.cityOfTravelDomestic],
                  ['Date of Travel',     td.dateOfTravel],
                  ['Place of Stay',      td.placeOfStay],
                  ['Client Name',        td.clientName],
                  ['Client Company',     td.clientCompany],
                ].filter(([, v]) => v);

                const reason = td.reasonOfTravel;

                return (
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Travel Details</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: reason ? 2 : 0 }}>
                      {fields.map(([label, value]) => (
                        <Box key={label} sx={{ bgcolor: 'grey.50', borderRadius: 1, px: 2, py: 1 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>{label}</Typography>
                          <Typography variant="body2">{value}</Typography>
                        </Box>
                      ))}
                    </Box>
                    {reason && (
                      <Box sx={{ bgcolor: '#EFF6FF', border: '1px solid', borderColor: 'primary.100', borderRadius: 1, px: 2, py: 1.5 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>Reason of Travel</Typography>
                        <Typography variant="body2" sx={{ mt: 0.5, lineHeight: 1.6 }}>{reason}</Typography>
                      </Box>
                    )}
                  </Box>
                );
              })()}
            </Box>
          ) : (
            <Typography color="text.secondary">Could not load request details.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReqModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ── Doc Viewer Modal ─────────────────────────────────────────────── */}
      <Dialog open={docModalOpen} onClose={() => setDocModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InsertDriveFile color="primary" />
            <Typography variant="h6" fontWeight={700}>
              {docModal?.label} — Documents
            </Typography>
          </Box>
          <Button size="small" onClick={() => setDocModalOpen(false)} startIcon={<Close />}>Close</Button>
        </DialogTitle>
        <DialogContent dividers>
          {docLoading ? (
            <Box sx={{ py: 4 }}><LinearProgress /></Box>
          ) : (
            <>
              {/* Section text details */}
              {docModal?.sectionDetails && Object.keys(docModal.sectionDetails).length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Saved Details</Typography>
                  <Box sx={{ bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.200', overflow: 'hidden' }}>
                    {Object.entries(docModal.sectionDetails).filter(([, v]) => v?.trim()).map(([k, v]) => (
                      <Box key={k} sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'grey.200', '&:last-child': { borderBottom: 0 } }}>
                        <Box sx={{ width: 160, minWidth: 160, px: 2, py: 1, bgcolor: 'grey.100' }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1')}</Typography>
                        </Box>
                        <Box sx={{ px: 2, py: 1, flex: 1 }}>
                          <Typography variant="body2">{v}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              {/* Documents */}
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Uploaded Files ({docModal?.docs?.length || 0})
              </Typography>
              {!docModal?.docs?.length ? (
                <Typography variant="body2" color="text.secondary">No documents uploaded for this section.</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {docModal.docs.map(doc => (
                    <Box key={doc.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.200' }}>
                      <InsertDriveFile color="primary" fontSize="small" />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{doc.original_name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(doc.uploaded_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {doc.uploaded_by && <> · {doc.uploaded_by}</>}
                        </Typography>
                      </Box>
                      <AttachmentButton
                        fileUrl={getFileUrl(`/uploads/${doc.filename}`)}
                        label="Open"
                        sx={{ flexShrink: 0 }}
                      />
                    </Box>
                  ))}
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDocModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
