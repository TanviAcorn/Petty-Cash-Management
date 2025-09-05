import React, { useEffect, useState } from "react";
import { Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField, Button, Typography } from "@mui/material";

export default function AddCategoryModal({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState({ name: "", description: "" });

  useEffect(() => {
    if (initial) {
      setForm({ name: initial.name || "", description: initial.description || "" });
    } else {
      setForm({ name: "", description: "" });
    }
  }, [initial]);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({ name: form.name.trim(), description: form.description.trim() });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Create New Category
        <Typography variant="body2" color="text.secondary">
          Add a new expense category to organize petty cash requests.
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} component="form" onSubmit={handleSubmit}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Category Name"
              placeholder="e.g., Travel"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Description"
              placeholder="e.g., Travel and accommodation expenses"
              name="description"
              value={form.description}
              onChange={handleChange}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="primary" onClick={handleSubmit}>
          {initial ? "Update" : "Create Category"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
