import { api } from "../../api.js";

const ROLES = ["client", "admin_store", "admin_tech"];

export async function renderUsersTab(container, isCurrentTab = () => true) {
  container.innerHTML = `<div class="text-center py-12 text-gray-400">Cargando usuarios...</div>`;
  const { users } = await api.adminListUsers();
  if (!isCurrentTab()) return;

  container.innerHTML = `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
      <table class="w-full text-left">
        <thead class="bg-brand-cream text-sm uppercase text-gray-600">
          <tr>
            <th class="px-4 py-3">Nombre</th>
            <th class="px-4 py-3">Correo</th>
            <th class="px-4 py-3">Rol</th>
          </tr>
        </thead>
        <tbody>
          ${users
            .map(
              (u) => `
            <tr class="border-t border-gray-100">
              <td class="px-4 py-3">${u.full_name || "-"}</td>
              <td class="px-4 py-3 text-sm text-gray-500">${u.email}</td>
              <td class="px-4 py-3">
                <select data-user="${u.id}" class="border border-gray-300 rounded-lg px-2 py-1 text-sm">
                  ${ROLES.map((r) => `<option value="${r}" ${r === u.role ? "selected" : ""}>${r}</option>`).join("")}
                </select>
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  container.querySelectorAll("[data-user]").forEach((select) => {
    select.addEventListener("change", async () => {
      const userId = select.dataset.user;
      const previous = users.find((u) => u.id === userId).role;
      select.disabled = true;
      try {
        await api.adminUpdateUserRole(userId, select.value);
        users.find((u) => u.id === userId).role = select.value;
      } catch (err) {
        alert(err.message);
        select.value = previous;
      }
      select.disabled = false;
    });
  });
}
