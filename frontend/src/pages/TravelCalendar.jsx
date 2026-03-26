import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress,
  IconButton, Avatar, Tooltip, Dialog, DialogTitle, DialogContent,
  Table, TableBody, TableCell, TableRow, TableContainer,
} from '@mui/material';
import { ChevronLeft, ChevronRight, FlightTakeoff, Hotel, Restaurant, LocalParking, Luggage, DirectionsCar } from '@mui/icons-material';
import axiosClient from '../api/axiosClient';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Colour per employee (cycles through palette)
const PALETTE = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#84CC16'];
const colorFor = (name) => PALETTE[Math.abs([...name].reduce((a,c)=>a+c.charCodeAt(0),0)) % PALETTE.length];

const REQ_ICONS = {
  flights: <FlightTakeoff sx={{ fontSize: 13 }} />,
  hotel: <Hotel sx={{ fontSize: 13 }} />,
  food: <Restaurant sx={{ fontSize: 13 }} />,
  carPark: <LocalParking sx={{ fontSize: 13 }} />,
  baggage: <Luggage sx={{ fontSize: 13 }} />,
  rentedVehicle: <DirectionsCar sx={{ fontSize: 13 }} />,
};

export default function TravelCalendar() {
  const [today]       = useState(new Date());
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [trips,  setTrips]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // trip detail dialog

  useEffect(() => {
    const fetchTrips = async () => {
      setLoading(true);
      try {
        const res = await axiosClient.get('/l1-approvals');
        const raw = res.data?.data || [];
        // Only approved requests with travel data
        const parsed = raw
          .filter(r => r.l1_approval_status === 'approved' && (r.travel_form_data || r.travel_details))
          .map(r => {
            // travel_form_data takes priority, fall back to travel_details
            const td = r.travel_form_data || r.travel_details;
            const name = `${r.employeeFirstName || ''} ${r.employeeLastName || ''}`.trim() || r.employee_email;

            // Extract departure + return dates
            let departure = null, returnDate = null;

            if (td.travelType === 'domestic') {
              // Use flexible from-date if set, otherwise fixed date
              const flexFrom = td.domesticDateFlexFrom;
              const flexTo   = td.domesticDateFlexTo;
              departure  = flexFrom ? new Date(flexFrom) : (td.dateOfTravel ? new Date(td.dateOfTravel) : null);
              returnDate = flexTo   ? new Date(flexTo)   : null;
            } else if (td.tripType === 'roundTrip' && td.roundTrip) {
              departure  = td.roundTrip.departureDate || td.roundTrip.departureDateFlexFrom
                ? new Date(td.roundTrip.departureDate || td.roundTrip.departureDateFlexFrom) : null;
              returnDate = td.roundTrip.arrivalDate || td.roundTrip.arrivalDateFlexFrom
                ? new Date(td.roundTrip.arrivalDate || td.roundTrip.arrivalDateFlexFrom) : null;
            } else if (td.tripType === 'multiCity' && td.multiCityLegs?.length) {
              departure  = td.multiCityLegs[0]?.date ? new Date(td.multiCityLegs[0].date) : null;
              const last = td.multiCityLegs[td.multiCityLegs.length - 1];
              returnDate = last?.date ? new Date(last.date) : null;
            }

            return { id: r.id, name, email: r.employee_email, td, departure, returnDate, request: r };
          })
          .filter(t => t.departure);

        setTrips(parsed);
      } catch (err) {
        console.error('Calendar fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTrips();
  }, []);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); };

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  while (cells.length % 7 !== 0) cells.push(null);

  // Get trips active on a given day
  const tripsOnDay = (day) => {
    if (!day) return [];
    const d = new Date(year, month, day);
    d.setHours(0,0,0,0);
    return trips.filter(t => {
      const dep = t.departure ? new Date(t.departure) : null;
      const ret = t.returnDate ? new Date(t.returnDate) : dep;
      if (dep) { dep.setHours(0,0,0,0); }
      if (ret) { ret.setHours(0,0,0,0); }
      return dep && d >= dep && d <= (ret || dep);
    });
  };

  const isToday = (day) => day && year === today.getFullYear() && month === today.getMonth() && day === today.getDate();

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>Travel Calendar</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        All approved employee travel bookings at a glance
      </Typography>

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: 0 }}>
          {/* Month navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <IconButton onClick={prevMonth} size="small"><ChevronLeft /></IconButton>
            <Typography variant="h6" fontWeight={700}>{MONTH_NAMES[month]} {year}</Typography>
            <IconButton onClick={nextMonth} size="small"><ChevronRight /></IconButton>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
          ) : (
            <Box sx={{ p: 2 }}>
              {/* Day headers */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 1 }}>
                {DAY_NAMES.map(d => (
                  <Typography key={d} variant="caption" fontWeight={700} color="text.secondary" sx={{ textAlign: 'center', py: 0.5 }}>{d}</Typography>
                ))}
              </Box>

              {/* Calendar cells */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
                {cells.map((day, idx) => {
                  const dayTrips = tripsOnDay(day);
                  return (
                    <Box
                      key={idx}
                      sx={{
                        minHeight: 90,
                        borderRadius: 1.5,
                        border: '1px solid',
                        borderColor: isToday(day) ? 'primary.main' : 'divider',
                        bgcolor: isToday(day) ? 'primary.50' : day ? 'background.paper' : 'transparent',
                        p: 0.75,
                        opacity: day ? 1 : 0,
                        cursor: dayTrips.length > 0 ? 'pointer' : 'default',
                      }}
                    >
                      {day && (
                        <>
                          <Typography
                            variant="caption"
                            fontWeight={isToday(day) ? 800 : 500}
                            color={isToday(day) ? 'primary.main' : 'text.primary'}
                            sx={{ display: 'block', mb: 0.5 }}
                          >
                            {day}
                          </Typography>
                          {dayTrips.slice(0, 3).map(t => (
                            <Tooltip key={t.id} title={`${t.name} — Trip #${t.id}`}>
                              <Box
                                onClick={() => setSelected(t)}
                                sx={{
                                  display: 'flex', alignItems: 'center', gap: 0.5,
                                  bgcolor: colorFor(t.name), color: '#fff',
                                  borderRadius: 1, px: 0.75, py: 0.25, mb: 0.25,
                                  fontSize: '0.68rem', fontWeight: 600,
                                  overflow: 'hidden', whiteSpace: 'nowrap',
                                  cursor: 'pointer',
                                  '&:hover': { opacity: 0.85 },
                                }}
                              >
                                <FlightTakeoff sx={{ fontSize: 11 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {t.name.split(' ')[0]}
                                </span>
                              </Box>
                            </Tooltip>
                          ))}
                          {dayTrips.length > 3 && (
                            <Typography variant="caption" color="text.secondary">+{dayTrips.length - 3} more</Typography>
                          )}
                        </>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Trip detail dialog */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        {selected && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
              <Avatar sx={{ bgcolor: colorFor(selected.name), width: 36, height: 36, fontSize: '0.9rem' }}>
                {selected.name[0]}
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>{selected.name}</Typography>
                <Typography variant="caption" color="text.secondary">{selected.email} · Trip #{selected.id}</Typography>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    {[
                      { label: 'Travel Type', value: selected.td.travelType === 'domestic' ? 'Domestic' : 'International' },
                      selected.td.countryOfTravel && { label: 'Country', value: selected.td.countryOfTravel },
                      selected.td.cityOfTravelDomestic && { label: 'City', value: selected.td.cityOfTravelDomestic },
                      selected.td.tripType && { label: 'Trip Type', value: selected.td.tripType === 'roundTrip' ? 'Round Trip' : selected.td.tripType === 'multiCity' ? 'Multi-City' : 'One Way' },
                      selected.td.roundTrip?.fromCity && { label: 'Route', value: `${selected.td.roundTrip.fromCity} → ${selected.td.roundTrip.toCity}` },
                      { label: 'Departure', value: formatDate(selected.departure) },
                      selected.returnDate && { label: 'Return', value: formatDate(selected.returnDate) },
                      selected.td.reasonOfTravel && { label: 'Reason', value: selected.td.reasonOfTravel },
                    ].filter(Boolean).map(row => (
                      <TableRow key={row.label}>
                        <TableCell sx={{ fontWeight: 600, color: 'text.secondary', bgcolor: 'action.hover', width: '38%', fontSize: '0.8rem', py: 1 }}>{row.label}</TableCell>
                        <TableCell sx={{ fontSize: '0.8rem', py: 1 }}>{row.value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Requirements chips */}
              {(() => {
                const reqs = selected.td.requirements || {};
                const labels = { flights:'Flights', visa:'Visa', rentedVehicle:'Rented Vehicle', carPark:'Airport Car Park', food:'Food Preferance', baggage:'Baggage Requirements' };
                const active = Object.entries(reqs).filter(([,v])=>v).map(([k])=>k);
                return active.length > 0 ? (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Requirements</Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.75 }}>
                      {active.map(k => (
                        <Chip key={k} size="small" icon={REQ_ICONS[k]} label={labels[k]||k} variant="outlined" color="primary" />
                      ))}
                    </Box>
                  </Box>
                ) : null;
              })()}
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}
