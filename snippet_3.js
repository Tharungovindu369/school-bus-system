Created At: 2026-06-20T17:55:42Z
Completed At: 2026-06-20T17:56:23Z

				The command completed successfully.
				Output:
				
> app.post('/api/driver/login', async (req, res) => {
    try {
      const { pin, busNumber } = req.body;
> app.post('/api/reception/login', async (req, res) => {
    const { pin } = req.body;
    if (String(pin) === (await getReceptionPin())) {
> app.post('/api/bus/location', async (req, res) => {
    try {
      const { bus_number, lat, lng } = req.body;
> app.post('/api/bus/start', async (req, res) => {
    try {
      const { bus_number, driver_name } = req.body;
> app.post('/api/bus/start-return', async (req, res) => {
    try {
      const { bus_number, driver_name } = req.body;
> app.post('/api/bus/stop', async (req, res) => {
    try {
      const { bus_number, driver_name } = req.body;
> app.post('/api/bus/stop-return', async (req, res) => {
    try {
      const { bus_number, driver_name } = req.body;
> app.post('/api/reassignments', async (req, res) => {
    try {
      const password = req.headers['x-admin-password'];
> app.post('/api/notify', async (req, res) => {
    try {
      const { student_id, bus_number, stop_name, scan_type } = req.body;
> app.post('/api/scan', async (req, res) => {
    try {
      const { student_id, driver_name, bus_number, stop_name } = req.body;
> app.post('/api/reception/scan', async (req, res) => {
    try {
      const { student_id } = req.body;
> app.post('/api/admin/login', async (req, res) => {
    const { password } = req.body;
    if (password === (await getAdminPassword())) {
> app.post('/api/admin/credentials', async (req, res) => {
    const { password, type, key, value } = req.body;
    if (password !== (await getAdminPassword())) return res.status(401).json({ error: 'Unauthorized' });



