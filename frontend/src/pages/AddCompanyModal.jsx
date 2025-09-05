import React, { useEffect, useState } from "react";
import { Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField, Button, MenuItem } from "@mui/material";

const countries = [
  "USA",
  "UK",
  "Canada",
  "Germany",
  "Poland",
  "India",
  "Australia",
];

export default function AddCompanyModal({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState({ name: "", code: "", country: "" });

  useEffect(() => {
    if (initial) {
      setForm({ name: initial.name || "", code: initial.code || "", country: initial.country || "" });
    } else {
      setForm({ name: "", code: "", country: "" });
    }
  }, [initial]);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) return;
    onSave({ name: form.name.trim(), code: form.code.trim(), country: form.country.trim() });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initial ? "Edit Company" : "Create New Company"}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} component="form" onSubmit={handleSubmit}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Company Name"
              placeholder="e.g., Acme Corp"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Company Code"
              placeholder="e.g., ACME"
              name="code"
              value={form.code}
              onChange={handleChange}
              inputProps={{ style: { textTransform: "uppercase" } }}
              required
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              select
              fullWidth
              label="Country"
              name="country"
              value={form.country}
              onChange={handleChange}
            >
              {countries.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit}>{initial ? "Update" : "Create Company"}</Button>
      </DialogActions>
    </Dialog>
  );
}
