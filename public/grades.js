document.addEventListener('DOMContentLoaded', () => {
  const formCard = document.getElementById('grades-form');
  if (!formCard) return;

  const tbody = document.querySelector('#subjects-table tbody');
  const template = document.getElementById('subject-row-template');
  const addRowBtn = document.getElementById('add-row-btn');
  const gpaDisplay = document.getElementById('gpa-display');
  const saveBtn = document.getElementById('save-grades-btn');
  const statusDiv = document.getElementById('save-status');

  function recalcGpa() {
    let totalCredits = 0;
    let totalPoints = 0;
    tbody.querySelectorAll('.subject-row').forEach((row) => {
      const credits = parseFloat(row.querySelector('.credit-hours').value) || 0;
      const grade = parseFloat(row.querySelector('.grade-point').value) || 0;
      totalCredits += credits;
      totalPoints += credits * grade;
    });
    gpaDisplay.textContent = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '-';
  }

  function bindRow(row) {
    row.querySelector('.credit-hours').addEventListener('input', recalcGpa);
    row.querySelector('.grade-point').addEventListener('change', recalcGpa);
    row.querySelector('.remove-row').addEventListener('click', () => {
      row.remove();
      recalcGpa();
    });
  }

  tbody.querySelectorAll('.subject-row').forEach(bindRow);
  recalcGpa();

  addRowBtn.addEventListener('click', () => {
    const clone = template.content.cloneNode(true);
    tbody.appendChild(clone);
    bindRow(tbody.lastElementChild);
    recalcGpa();
  });

  saveBtn.addEventListener('click', async () => {
    const subjects = [];
    tbody.querySelectorAll('.subject-row').forEach((row) => {
      subjects.push({
        subject_name: row.querySelector('.subject-name').value,
        credit_hours: row.querySelector('.credit-hours').value,
        grade_point: row.querySelector('.grade-point').value,
      });
    });

    statusDiv.textContent = 'กำลังบันทึก...';
    statusDiv.className = 'text-sm font-medium text-gray-500';

    try {
      const res = await fetch('/api/grades/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: Number(formCard.dataset.studentId),
          term: formCard.dataset.term,
          subjects,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        statusDiv.textContent = 'บันทึกสำเร็จ';
        statusDiv.className = 'text-sm font-medium text-emerald-600';
      } else {
        statusDiv.textContent = `เกิดข้อผิดพลาด: ${data.error}`;
        statusDiv.className = 'text-sm font-medium text-rose-600';
      }
    } catch (err) {
      statusDiv.textContent = `เกิดข้อผิดพลาด: ${err}`;
      statusDiv.className = 'text-sm font-medium text-rose-600';
    }
  });
});
