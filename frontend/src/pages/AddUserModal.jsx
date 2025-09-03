import { useState } from "react";
import { X } from "lucide-react";

export default function AddUserModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "user",
    company: "",
    department: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name: `${form.firstName} ${form.lastName}`,
      email: form.email,
      role: form.role,
      company: form.company,
      department: form.department,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <div className="bg-white rounded-xl w-[500px] p-6 relative">
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          onClick={onClose}
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-semibold mb-2">Create New User</h2>
        <p className="text-sm text-gray-500 mb-6">
          Add a new user to the system with their role and company information.
        </p>

        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <input
            type="text"
            name="firstName"
            placeholder="First Name"
            className="border rounded-lg px-3 py-2 col-span-1"
            onChange={handleChange}
            required
          />
          <input
            type="text"
            name="lastName"
            placeholder="Last Name"
            className="border rounded-lg px-3 py-2 col-span-1"
            onChange={handleChange}
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            className="border rounded-lg px-3 py-2 col-span-2"
            onChange={handleChange}
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            className="border rounded-lg px-3 py-2 col-span-2"
            onChange={handleChange}
            required
          />
          <select
            name="role"
            className="border rounded-lg px-3 py-2 col-span-1"
            onChange={handleChange}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <input
            type="text"
            name="company"
            placeholder="Company"
            className="border rounded-lg px-3 py-2 col-span-1"
            onChange={handleChange}
            required
          />
          <select
            name="department"
            className="border rounded-lg px-3 py-2 col-span-2"
            onChange={handleChange}
            required
          >
            <option value="">Select department</option>
            <option value="IT">IT</option>
            <option value="Finance">Finance</option>
            <option value="Admin">Admin</option>
          </select>

          <div className="col-span-2 flex justify-end gap-2 mt-4">
            <button
              type="button"
              className="px-4 py-2 rounded-lg border"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
            >
              Create User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
