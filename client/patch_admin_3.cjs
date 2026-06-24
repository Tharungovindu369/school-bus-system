const fs = require('fs');

let content = fs.readFileSync('src/pages/AdminDashboard.jsx', 'utf8');

// Replace the old toggleFee function with the new one
const toggleFeeRegex = /const toggleFee = async \(student\) => \{[\s\S]*?\}\s*};\s*/;
if (toggleFeeRegex.test(content)) {
    content = content.replace(toggleFeeRegex, `const toggleFee = (s) => {
    setSelectedStudentForFee(s);
  };
  
  const handleUpdateFee = async (studentId, dateStr) => {
    try {
      await api.updateFee(studentId, dateStr, auth);
      toast.success('Fee updated');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };
  
  const handleEditBus = async (busNumber, driverName, driverPhone) => {
    try {
      await api.updateBusDriver(busNumber, driverName, driverPhone, auth);
      toast.success('Bus driver updated');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

`);
}

fs.writeFileSync('src/pages/AdminDashboard.jsx', content);
console.log('Fixed toggleFee logic');
