fetch('http://localhost:3000/api/appointments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    patientName: 'Test',
    patientPhone: '123456',
    patientEmail: 'test@example.com',
    doctorId: 'doc-1',
    date: '2026-03-09',
    time: '09:00 AM',
    service: 'General Consultation'
  })
}).then(res => res.json()).then(data => console.log(data)).catch(err => console.error(err));
