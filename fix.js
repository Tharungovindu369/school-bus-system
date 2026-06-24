import { updateStudentBusNumber, getStudents } from './server/services/sheets.js';

async function fix() {
  const students = await getStudents();
  const student = students.find(s => s.student_id === 'S0305');
  console.log('Found student:', student);
  if (student) {
    await updateStudentBusNumber('S0305', 'Bus 1');
    console.log('Successfully updated S0305 to Bus 1');
  }
}
fix().catch(console.error);
