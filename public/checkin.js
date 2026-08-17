document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('save-btn');
  if (!saveBtn) return;

  saveBtn.addEventListener('click', async () => {
    const rows = document.querySelectorAll('#checkin-list [data-student-id]');
    const entries = [];

    rows.forEach((row) => {
      const studentId = parseInt(row.dataset.studentId, 10);
      const statusInput = row.querySelector('.status-radio:checked');
      const status = statusInput ? statusInput.value : 'present';
      const note = row.querySelector('.note-input').value;
      const items = {};
      row.querySelectorAll('.item-radio:checked').forEach((input) => {
        items[input.dataset.item] = input.value;
      });
      entries.push({ student_id: studentId, status, items, note });
    });

    const statusDiv = document.getElementById('save-status');
    statusDiv.textContent = 'กำลังบันทึก...';
    statusDiv.className = 'save-status mb-3 text-sm font-medium text-gray-500';

    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: window.CHECKIN_DATE, entries }),
      });
      const data = await res.json();
      if (data.ok) {
        statusDiv.textContent = 'บันทึกสำเร็จ';
        statusDiv.className = 'save-status mb-3 text-sm font-medium text-emerald-600';
      } else {
        statusDiv.textContent = `เกิดข้อผิดพลาด: ${data.error}`;
        statusDiv.className = 'save-status mb-3 text-sm font-medium text-rose-600';
      }
    } catch (err) {
      statusDiv.textContent = `เกิดข้อผิดพลาด: ${err}`;
      statusDiv.className = 'save-status mb-3 text-sm font-medium text-rose-600';
    }
  });
});
