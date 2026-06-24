Created At: 2026-06-21T12:25:34Z
Completed At: 2026-06-21T12:25:36Z
File Path: `file:///D:/school-bus-system/server/index.js`
Total Lines: 1190
Total Bytes: 40534
Showing lines 900 to 1100
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
900:         incident_type: 'missed_driver_scan',
901:         details: 'Student arrived at college without driver boarding scan',
902:         timestamp: nowTimestamp(),
903:       });
904:       await sendAdminMissedScanAlert({
905:         studentName: student.name,
906:         busNumber: formattedBus,
907:         driverName,
908:       });
909:     }
910: 
911:     res.json({
912:       success: true,
913:       scan_type: 'college_arrival',
914:       student,
915:       missedScan,
916:       driverScanned: !!driverScan,
917:       isCrossBus,
918:       boardingBus,
919:       message: missedScan
920:         ? `⚠️ WARNING: ${student.name} arrived at college BUT was NOT scanned by driver of ${formattedBus} today. Please check with the driver immediately.`
921:         : isCrossBus
922:           ? `✅ ${student.name} arrived at college (boarded ${boardingBus} today, usual bus ${formattedBus})`
923:           : `✅ ${student.name} arrived at college via ${boardingBus}`,
924:     });
925:   } catch (err) {
926:     res.status(500).json({ error: err.message });
927:   }
928: });
929: 
930: app.post('/api/admin/login', loginLimiter, async (req, res) => {
931:   const { password } = req.body;
932:   if (await verifyCredential(password, await getAdminPassword())) {
933:     return res.json({ success: true });
934:   }
935:   res.status(401).json({ error: 'Invalid Admin Password' });
936: });
937: 
938: app.get('/api/admin/credentials', async (req, res) => {
939:   const { password } = req.query;
940:   if (!(await verifyCredential(password, await getAdminPassword()))) return res.status(401).json({ error: 'Unauthorized' });
941:   
942:   res.json((await getAllCredentials()));
943: });
944: 
945: app.post('/api/admin/credentials', async (req, res) => {
946:   const { password, type, key, value } = req.body;
947:   if (!(await verifyCredential(password, await getAdminPassword()))) return res.status(401).json({ error: 'Unauthorized' });
948:   
949:   try {
950:     if (type === 'driverPin' && (!value || !/^\d{4}$/.test(value))) {
951:       return res.status(400).json({ error: 'Driver PIN must be exactly 4 digits' });
952:     }
953:     if (type === 'receptionPin' && (!value || !/^\d{4}$/.test(value))) {
954:       return res.status(400).json({ error: 'Reception PIN must be exactly 4 digits' });
955:     }
956:     if (type === 'adminPassword' && (!value || value.length < 6)) {
957:       return res.status(400).json({ error: 'Admin password must be at least 6 characters' });
958:     }
959: 
960:     await updateCredential(type, key, value);
961:     res.json({ success: true });
962:   } catch (e) {
963:     res.status(400).json({ error: e.message });
964:   }
965: });
966: 
967: app.get('/api/admin/student/:id', async (req, res) => {
968:   const { password } = req.query;
969:   if (!(await verifyCredential(password, await getAdminPassword()))) return res.status(401).json({ error: 'Unauthorized' });
970: 
971:   try {
972:     const studentId = req.params.id;
973:     const student = await sheets.getStudentById(studentId);
974:     if (!student) return res.status(404).json({ error: 'Student not found' });
975: 
976:     student.calculated_fee_status = isFeeDue(student, getISTDateString()) ? 'DUE' : 'PAID';
977: 
978:     const allRecords = await sheets.getAttendance(); // Fetches all attendance history
979:     const history = allRecords
980:       .filter(r => r.student_id === studentId)
981:       .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
982:       .slice(0, 5);
983: 
984:     res.json({ student, history });
985:   } catch (error) {
986:         incident_type: 'fee_defaulter',
987:         details: 'Student boarded with fee status DUE',
988:         timestamp: nowTimestamp(),
989:       });
990:     }
991: 
992:     await sheets.updateNotificationStatus(student_id, today, scanType, notificationStatus);
993: 
994:     res.json({
995:       success: true,
996:       scan_type: scanType,
997:       student,
998:       record,
999:       notification: notifyResult,
1000:       feeAlert: ['boarding', 'return_boarding'].includes(scanType) && isDue,
1001:       feeAlertMessage: ['boarding', 'return_boarding'].includes(scanType) && isDue ? FEE_ALERT_MESSAGE : null,
1002:       isCrossBus,
1003:       crossBusNote: isCrossBus
1004:         ? `ℹ️ Note: ${student.name}'s regular bus is ${assignedBus}, boarding ${formattedBus} today`
1005:         : null,
1006:     });
1007:   } catch (err) {
1008:     res.status(500).json({ error: err.message });
1009:   }
1010: });
1011: 
1012: app.post('/api/reception/scan', async (req, res) => {
1013:   try {
1014:     const { student_id } = req.body;
1015:     const student = await sheets.getStudentById(student_id);
1016:     if (!student) return res.status(404).json({ error: 'Student not found' });
1017: 
1018:     const today = getISTDateString();
1019:     const formattedBus = formatBusNumber(student.bus_number);
1020:     const arrivalTime = formatISTTime();
1021:     const bus = await sheets.getBusByNumber(formattedBus);
1022:     const driverName = bus?.driver_name || 'Unknown';
1023: 
1024:     const existingArrival = await sheets.findAttendanceRecord(
1025:       student_id,
1026:       formattedBus,
1027:       today,
1028:       'college_arrival'
1029:     );
1030: 
1031:     if (existingArrival) {
1032:       await sheets.appendIncident({
1033:         date: today,
1034:         student_id: student.student_id,
1035:         student_name: student.name,
1036:         bus_number: formattedBus,
1037:         driver_name: driverName,
1038:         incident_type: 'duplicate_scan',
1039:         details: 'Duplicate college_arrival scan at reception',
1040:         timestamp: nowTimestamp(),
1041:       });
1042:       return res.json({
1043:         success: true,
1044:         duplicate: true,
1045:         student,
1046:         message: `⚠️ ${student.name} has already been scanned at college today`,
1047:       });
1048:     }
1049: 
1050:     const driverScan = await sheets.hasDriverScanToday(student_id, today);
1051:     const missedScan = !driverScan;
1052: 
1053:     let notificationStatus = 'college_arrival';
1054:     if (missedScan) notificationStatus += '; missed_driver_scan';
1055: 
1056:     const boardingBus = driverScan
1057:       ? formatBusNumber(driverScan.actual_bus || driverScan.bus_number)
1058:       : formattedBus;
1059:     const isCrossBus =
1060:       !!driverScan &&
1061:       String(driverScan.is_cross_bus).toUpperCase() === 'TRUE';
1062: 
1063:     const record = {
1064:       timestamp: nowTimestamp(),
1065:       student_id: student.student_id,
1066:       student_name: student.name,
1067:       bus_number: formattedBus,
1068:       stop_name: student.stop_name,
1069:       boarded_at: driverScan?.boarded_at || '',
1070:       driver_name: driverScan?.driver_name || driverName,
1071:       date: today,
1072:       notification_status: notificationStatus,
1073:       scan_type: 'college_arrival',
1074:       dropoff_time: '',
1075:       scanned_by: 'reception',
1076:       arrival_time: arrivalTime,
1077:     };
1078: 
1079:     await sheets.appendAttendance(record);
1080: 
1081:     await sendCollegeArrivalNotification({
1082:       parentWhatsapp: student.parent_whatsapp,
1083:       studentName: student.name,
1084:       busNumber: boardingBus,
1085:       withBus: !missedScan,
1086:     });
1087: 
1088:     if (missedScan) {
1089:       await sheets.appendIncident({
1090:         date: today,
1091:         student_id: student.student_id,
1092:         student_name: student.name,
1093:         bus_number: formattedBus,
1094:         driver_name: driverName,
1095:         incident_type: 'missed_driver_scan',
1096:         details: 'Student arrived at college without driver boarding scan',
1097:         timestamp: nowTimestamp(),
1098:       });
1099:       await sendAdminMissedScanAlert({
1100:         studentName: student.name,
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
