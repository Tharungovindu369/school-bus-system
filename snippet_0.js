Created At: 2026-06-20T03:16:22Z
Completed At: 2026-06-20T03:17:41Z
File Path: `file:///D:/school-bus-system/server/index.js`
Total Lines: 757
Total Bytes: 24364
Showing lines 501 to 650
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
501: app.post('/api/scan', async (req, res) => {
502:   try {
503:     const { student_id, driver_name, bus_number, stop_name } = req.body;
504:     const student = await sheets.getStudentById(student_id);
505:     if (!student) return res.status(404).json({ error: 'Student not found' });
506: 
507:     const today = getISTDateString();
508:     const formattedBus = formatBusNumber(bus_number || student.bus_number);
509:     const bus = await sheets.getBusByNumber(formattedBus);
510:     const scanType = getDriverScanType(bus);
511:     const scanTime = formatISTTime();
512:     const driverName = driver_name || bus?.driver_name || 'Driver';
513: 
514:     const existing = await sheets.findAttendanceRecord(
515:       student_id,
516:       formattedBus,
517:       today,
518:       scanType
519:     );
520: 
521:     if (existing) {
522:       await logDuplicateIncident(student, formattedBus, driverName, scanType);
523:       const action =
524:         scanType === 'dropoff' ? 'dropped off' :
525:         scanType === 'return_boarding' ? 'scanned for return' : 'scanned';
526:       return res.json({
527:         success: true,
528:         duplicate: true,
529:         scan_type: scanType,
530:         student,
531:         message: `⚠️ ${student.name} has already been ${action} today on ${formattedBus}`,
532:       });
533:     }
534: 
535:     const isDue = isFeeDue(student, today);
536:     const assignedBus = formatBusNumber(student.bus_number);
537:     const isCrossBus =
538:       ['boarding', 'return_boarding'].includes(scanType) &&
539:       !busesMatch(assignedBus, formattedBus);
540: 
541:     const record = {
542:       timestamp: nowTimestamp(),
543:       student_id: student.student_id,
544:       student_name: student.name,
545:       bus_number: formattedBus,
546:       stop_name: stop_name || student.stop_name,
547:       boarded_at: ['boarding', 'return_boarding'].includes(scanType) ? scanTime : '',
548:       driver_name: driverName,
549:       date: today,
550:       notification_status: 'pending',
551:       scan_type: scanType,
552:       dropoff_time: scanType === 'dropoff' ? scanTime : '',
553:       scanned_by: 'driver',
554:       arrival_time: '',
555:       is_cross_bus: isCrossBus,
556:       actual_bus: isCrossBus ? formattedBus : '',
557:       assigned_bus: isCrossBus ? assignedBus : '',
558:     };
559: 
560:     await sheets.appendAttendance(record);
561: 
562:     let notifyResult;
563:     if (scanType === 'dropoff') {
564:       notifyResult = await sendDropoffNotification({
565:         parentWhatsapp: student.parent_whatsapp,
566:         studentName: student.name,
567:         busNumber: formattedBus,
568:         stopName: record.stop_name,
569:       });
570:     } else if (scanType === 'return_boarding') {
571:       notifyResult = isCrossBus
572:         ? await sendCrossBusReturnBoardingNotification({
573:             parentWhatsapp: student.parent_whatsapp,
574:             studentName: student.name,
575:             actualBus: formattedBus,
576:             assignedBus,
577:           })
578:         : await sendReturnBoardingNotification({
579:             parentWhatsapp: student.parent_whatsapp,
580:             studentName: student.name,
581:             busNumber: formattedBus,
582:           });
583:     } else if (isCrossBus) {
584:       notifyResult = await sendCrossBusBoardingNotification({
585:         parentWhatsapp: student.parent_whatsapp,
586:         studentName: student.name,
587:         actualBus: formattedBus,
588:         assignedBus,
589:       });
590:     } else {
591:       notifyResult = await sendBoardingNotification({
592:         parentWhatsapp: student.parent_whatsapp,
593:         studentName: student.name,
594:         busNumber: formattedBus,
595:       });
596:     }
597: 
598:     let notificationStatus = notifyResult.method || 'none';
599:     if (['boarding', 'return_boarding'].includes(scanType) && isDue) {
600:       notificationStatus = `${notificationStatus}; fee_not_paid_alert`;
601:       await sheets.logIncidentIfNew({
602:         date: today,
603:         student_id: student.student_id,
604:         student_name: student.name,
605:         bus_number: formattedBus,
606:         driver_name: driverName,
607:         incident_type: 'fee_defaulter',
608:         details: 'Student boarded with fee status DUE',
609:         timestamp: nowTimestamp(),
610:       });
611:     }
612: 
613:     await sheets.updateNotificationStatus(student_id, today, scanType, notificationStatus);
614: 
615:     res.json({
616:       success: true,
617:       scan_type: scanType,
618:       student,
619:       record,
620:       notification: notifyResult,
621:       feeAlert: ['boarding', 'return_boarding'].includes(scanType) && isDue,
622:       feeAlertMessage: ['boarding', 'return_boarding'].includes(scanType) && isDue ? FEE_ALERT_MESSAGE : null,
623:       isCrossBus,
624:       crossBusNote: isCrossBus
625:         ? `ℹ️ Note: ${student.name}'s regular bus is ${assignedBus}, boarding ${formattedBus} today`
626:         : null,
627:     });
628:   } catch (err) {
629:     res.status(500).json({ error: err.message });
630:   }
631: });
632: 
633: app.post('/api/reception/scan', async (req, res) => {
634:   try {
635:     const { student_id } = req.body;
636:     const student = await sheets.getStudentById(student_id);
637:     if (!student) return res.status(404).json({ error: 'Student not found' });
638: 
639:     const today = getISTDateString();
640:     const formattedBus = formatBusNumber(student.bus_number);
641:     const arrivalTime = formatISTTime();
642:     const bus = await sheets.getBusByNumber(formattedBus);
643:     const driverName = bus?.driver_name || 'Unknown';
644: 
645:     const existingArrival = await sheets.findAttendanceRecord(
646:       student_id,
647:       formattedBus,
648:       today,
649:       'college_arrival'
650:     );
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
