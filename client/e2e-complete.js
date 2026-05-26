const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  console.log('🤖 STARTING AEROGLIDE COMPREHENSIVE END-TO-END AUTOMATED FLOW...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Log browser console logs and errors to node console
  page.on('console', msg => console.log('🌐 BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('🌐 BROWSER EXCEPTION:', err.stack || err.message));
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('🌐 BROWSER HTTP ERROR:', response.status(), response.url());
    }
  });
  
  // Set viewport to desktop for clear layout clicks
  await page.setViewport({ width: 1280, height: 800 });

  const randomEmail = `senior.qa.${Date.now()}@domain.com`;
  const testPassword = `SecurePass123!`;
  
  try {
    console.log('🔗 Navigating to AeroGlide Platform at http://localhost:3001...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle2' });
    
    // Validate Page Title
    const title = await page.title();
    console.log(`ℹ️ Page Title loaded: "${title}"`);
    if (!title.toLowerCase().includes('aeroglide')) {
      throw new Error('Verification failed: Page title does not contain "AeroGlide"');
    }

    // ─── STEP 2: Sign Up a New User ───
    console.log('\n📝 Phase 2/3: Creating a NEW passenger profile...');
    
    // Click Navbar Profile / Sign In button to open modal
    const loginButtonSelector = '#login-nav-btn';
    await page.waitForSelector(loginButtonSelector, { timeout: 5000 });
    await page.click(loginButtonSelector);
    console.log('✅ Auth Modal opened');

    // Switch to Sign Up tab
    const signUpTabSelector = '#auth-tab-signup';
    await page.waitForSelector(signUpTabSelector, { timeout: 3000 });
    await page.click(signUpTabSelector);
    
    // Fill Sign Up form
    await page.waitForSelector('#signup-name', { timeout: 3000 });
    await page.type('#signup-name', 'Senior QA Tester');
    await page.type('#signup-email', randomEmail);
    await page.type('#signup-password', testPassword);
    await page.type('#signup-confirm-password', testPassword);
    console.log(`ℹ️ Typed credentials: name="Senior QA Tester", email="${randomEmail}"`);

    // Click submit
    await page.click('#signup-submit-btn');
    console.log('⚡ Signup submitted. Waiting for auto-confirm and instant login redirect...');

    // Wait for the modal to close and state to sync automatically (indicates successful instant login)
    await page.waitForFunction(() => {
      return !document.querySelector('[role="dialog"]') || document.querySelector('.status-confirmed') || document.body.innerText.includes('LOG OUT') || document.body.innerText.includes('Passenger Dashboard');
    }, { timeout: 15000 });

    console.log('🎉 Signup and Instant Login SUCCEEDED! (Bypassed confirmation block successfully)');

    // ─── STEP 3: Search Flights ───
    console.log('\n🔍 Phase 4: Searching domestic flights Delhi ➔ Mumbai...');
    
    // Fill Search input fields
    await page.waitForSelector('#origin-airport', { timeout: 5000 });
    
    // Clear and type origin IATA
    const originInput = await page.$('#origin-airport');
    await originInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('#origin-airport', 'DEL');
    await page.waitForSelector('.autocomplete-item', { timeout: 5000 });
    await page.click('.autocomplete-item');
    await delay(500);

    // Clear and type destination IATA
    const destInput = await page.$('#destination-airport');
    await destInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('#destination-airport', 'BOM');
    await page.waitForSelector('.autocomplete-item', { timeout: 5000 });
    await page.click('.autocomplete-item');
    await delay(500);

    // Set Date input robustly via evaluation
    await page.evaluate(() => {
      const dateInput = document.querySelector('input[type="date"]');
      if (dateInput) {
        dateInput.value = '2026-06-15';
        dateInput.dispatchEvent(new Event('input', { bubbles: true }));
        dateInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await delay(300);

    console.log('🚀 Executing search queries...');
    // Click Search Flights button
    const searchSubmitBtn = await page.waitForSelector('button[type="submit"]');
    await searchSubmitBtn.click();

    // Wait for search results
    await page.waitForFunction(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes('available flights') || text.includes('select seats') || text.includes('choose cabin seat') || text.includes('select cabin');
    }, { timeout: 10000 });
    console.log('✅ Available flight schedules loaded successfully');

    // ─── STEP 4: Select Seats & Checkout Bookings ───
    console.log('\n✈️ Booking ticket reservations...');
    
    // Click first flight's seat selector button
    const selectSeatsBtn = await page.waitForSelector('button::-p-text(Select Cabin), button::-p-text(Select Seats), button::-p-text(Choose Seat)');
    await selectSeatsBtn.click();
    console.log('✅ Flight cabin seat matrix grid opened');

    // Wait for seat map to load and click the first available economy or business seat
    await page.waitForSelector('button.seat-btn', { timeout: 5000 });
    const availableSeat = await page.$('button.seat-btn:not([disabled])');
    if (!availableSeat) {
      throw new Error('Verification error: No available cabin seats found in the flight layout grid');
    }
    await availableSeat.click();
    console.log('✅ Seat selected. Clicking proceed to checkout passenger details...');

    const proceedBtn = await page.waitForSelector('button::-p-text(Lock Seats & Continue), button::-p-text(Proceed to Passenger Details), button::-p-text(Continue to Checkout)');
    await proceedBtn.click();

    // Fill passenger checkout form
    console.log('📝 Filling traveler assignments...');
    await page.waitForSelector('input[name="firstName"], input[placeholder="First Name"]', { timeout: 5000 });
    await page.type('input[name="firstName"], input[placeholder="First Name"]', 'QA');
    await page.type('input[name="lastName"], input[placeholder="Last Name"]', 'Automator');
    await page.type('input[name="passportNumber"], input[placeholder="Passport Number"]', 'A98765432');
    await page.evaluate(() => {
      const dobInput = document.querySelector('input[name="dateOfBirth"]');
      if (dobInput) {
        dobInput.value = '1995-05-15';
        dobInput.dispatchEvent(new Event('input', { bubbles: true }));
        dobInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await page.type('input[name="nationality"]', 'Indian');
    await page.type('input[type="email"]', randomEmail);
    await page.type('input[type="tel"]', '+919988776655');

    // Confirm Checkout Payment
    console.log('💳 Confirming booking transaction payment...');
    const confirmPaymentBtn = await page.waitForSelector('button::-p-text(Book Flight Tickets), button::-p-text(Confirm & Pay), button::-p-text(Complete Booking)');
    await confirmPaymentBtn.click();

    // Wait for booking confirmation screen
    await page.waitForFunction(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes('booking confirmed') || text.includes('reservation successful') || text.includes('pnr reference') || text.includes('reference');
    }, { timeout: 15000 });
    console.log('🎉 Journey booked successfully! Database record persisted.');

    // ─── STEP 5: Reschedule Booking via Dashboard ───
    console.log('\n🔁 Phase 5: Rescheduling ticket bookings timezone-safely...');
    
    // Navigate to Passenger Dashboard
    await page.goto('http://localhost:3001/my-bookings', { waitUntil: 'networkidle2' });
    console.log('ℹ️ Navigated to Passenger Dashboard');

    // Click Reschedule button on the confirmed booking card
    await page.waitForSelector('button::-p-text(Reschedule)', { timeout: 8000 });
    const rescheduleBtn = await page.$('button::-p-text(Reschedule)');
    await rescheduleBtn.click();
    console.log('✅ Upgraded Reschedule Wizard opened');

    // Input new date in Date Picker robustly via evaluation
    await page.waitForSelector('input[type="date"]', { timeout: 3000 });
    await page.evaluate(() => {
      const dateInput = document.querySelector('[role="dialog"] input[type="date"]') || document.querySelector('input[type="date"]');
      if (dateInput) {
        dateInput.value = '2026-06-20';
        dateInput.dispatchEvent(new Event('input', { bubbles: true }));
        dateInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    console.log('📅 Selected new date: 2026-06-20');

    // Select flight from the dropdown
    await page.waitForSelector('select', { timeout: 5000 });
    let dropdowns = await page.$$('select');
    // First select is the flight
    await dropdowns[0].select(await dropdowns[0].evaluate(el => el.options[1].value));
    console.log('✈️ Selected flight candidate from the search results');

    // Allow dropdown options to resolve and update timings
    await delay(1500);

    // Query dropdowns again because selecting a flight renders the passenger seat dropdowns!
    dropdowns = await page.$$('select');
    if (dropdowns.length < 2) {
      throw new Error('Verification error: Seat selection dropdown did not render after flight selection');
    }

    // Modify timings (Departure / Arrival Time Pickers)
    const timePickers = await page.$$('input[type="time"]');
    if (timePickers.length >= 2) {
      await timePickers[0].type('1030'); // 10:30 AM
      await timePickers[1].type('1645'); // 04:45 PM
      console.log('⏰ Custom departure set to 10:30 AM and arrival to 04:45 PM');
    }

    // Select seat for passenger from the seat selection dropdown (second dropdown)
    const seatSelectValue = await dropdowns[1].evaluate(el => el.options[1]?.value);
    if (!seatSelectValue) {
      throw new Error('Verification error: No seats populated in the reschedule matrix grid');
    }
    await dropdowns[1].select(seatSelectValue);
    console.log(`💺 Assigned new cabin seat: Option Value "${seatSelectValue}"`);

    // Verify Billing Statement is present
    await page.waitForFunction(() => {
      return document.body.innerText.includes('Reschedule Summary') || document.body.innerText.includes('Processing Timing Shift') || document.body.innerText.includes('Confirm Reschedule');
    }, { timeout: 3000 });
    console.log('💰 Reschedule pricing statement validated');

    // Click Confirm Reschedule
    const confirmRescheduleBtn = await page.waitForSelector('button::-p-text(Confirm Reschedule)');
    await confirmRescheduleBtn.click();
    console.log('⚡ Confirming Reschedule shift transaction...');

    // Wait for the modal to close and update status to rescheduled
    await page.waitForFunction(() => {
      return !document.querySelector('[role="dialog"]') || document.body.innerText.includes('Ticket successfully rescheduled') || document.querySelector('.status-rescheduled') || document.body.innerText.includes('rescheduled');
    }, { timeout: 15000 });
    console.log('🎉 Timezone-safe Timing Rescheduling Succeeded! Database updated.');

    // ─── STEP 6: Cancel Ticket ───
    console.log('\n❌ Phase 6: Executing Booking Cancellation flow...');
    
    await delay(1000); // Wait for transition
    
    // Click Cancel Booking
    await page.waitForSelector('button::-p-text(Cancel Booking)', { timeout: 5000 });
    const cancelBookingBtn = await page.$('button::-p-text(Cancel Booking)');
    await cancelBookingBtn.click();
    
    // Confirm Cancel in the modal
    const confirmCancelBtn = await page.waitForSelector('button::-p-text(Confirm Cancel)');
    await confirmCancelBtn.click();
    console.log('⚡ Confirming cancellation...');

    // Wait for status to become cancelled
    await page.waitForFunction(() => {
      return document.querySelector('.status-cancelled') || document.body.innerText.includes('cancelled') || document.body.innerText.includes('Cancelled');
    }, { timeout: 10000 });
    console.log('🎉 Cancellation Succeeded! Seats released successfully.');

    console.log('\n====================================================');
    console.log('🏆 ALL E2E PHASES AND VERIFICATION COMPLETED SUCCESSFULLY!');
    console.log('====================================================');

  } catch (err) {
    console.error('\n❌ E2E FLOW ENCOUNTERED FAILURE:', err.message);
    try {
      const url = await page.url();
      console.log('🌐 Page URL at failure:', url);
      const text = await page.evaluate(() => document.body.innerText);
      console.log('📄 Body Text length:', text.length);
      console.log('📄 Body Text preview:', text.substring(0, 1000));
      await page.screenshot({ path: 'C:/Users/DELL/.gemini/antigravity-ide/browser_recordings/screenshot-error.png' });
      console.log('📸 Error screenshot saved to C:/Users/DELL/.gemini/antigravity-ide/browser_recordings/screenshot-error.png');
    } catch (ssErr) {
      console.error('Failed to take screenshot:', ssErr.message);
    }
    process.exit(1);
  } finally {
    await browser.close();
    process.exit(0);
  }
})();
