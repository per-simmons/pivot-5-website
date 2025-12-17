# Email Conversation: Warmup ESP Next Steps (Dec 16, 2025)

> **Note:** This is an ongoing conversation. Pat will provide details as more people respond.

---

## Email Thread (Most Recent First)

---

### Pat Simmons <pat@pivotstudio.ai>
**Dec 16, 2025, 12:52 PM**
To: Kunal, Pierre, Vikas, Virginie

Hi all,

Nice to e-meet you Pierre and team. Confirming that we've sent out the first warm up email today to our 'Warmup - all emails' segment. Moving forward, emails should be sent each day at 8:30am EST.

Thanks,
Pat

---

### Kunal Gupta <hi@kunal.live>
**Dec 16, 2025, 10:47 AM**

Thanks Pierre.

We will address image size, email size and list-id this week. I do not believe it's on the critical path though to start warming, so we'll plan to send the first email tomorrow and layer in these updates soon.

Kunal

---

### Pierre Galiegue <pierre.galiegue@mailsoar.com>
**Dec 16, 2025, 9:11 AM**

Hi Kunal,

Please ensure that Vikas and Virginie are included in all future communications:
- Vikas is the consultant assigned to your project.
- Virginie will ensure nothing is missed and will monitor overall progress.

Regarding your questions:
- **Image size:** Please reduce image weight by compressing assets (for example, using https://tinypng.com/).
- **Email size:** Your AI analysis is correct, the message size is currently too large and will be clipped by Gmail. Reducing HTML weight is required.
- **List-ID:** This header is not mandatory, but it is a good practice. You can add a simple custom List-ID header to each campaign directly in Mautic.

Once these points are addressed, you should be in a good position to proceed with warmup and daily sends.

Best regards,

---

### Kunal Gupta <hi@kunal.live>
**Dec 16, 2025, 9:27 AM**

Hi Pierre,

Keen to start sending the daily email and begin the warmup.

What's outstanding from your perspective? (For us or you)

Kunal

---

### Kunal Gupta <hi@kunal.live>
**Dec 13, 2025, 7:16 AM**

Hi Pierre,

Below is the sample email. I ran it via chatgpt to get some deliverability analysis, here is what came back. What is your take on any deliverability improvements we need to make?

---

## ChatGPT Deliverability Analysis (from Kunal's Dec 13 email)

Below is a clear confirmation of what's correct in your email from a deliverability-best-practice standpoint — and what's still missing or risky — based directly on the raw message you shared.

### What You Already Have (All Good / Required)

Your message already includes every core authentication and compliance requirement:

**1. SPF: PASS**
- pivotnews.com authorizes your sending IP (207.244.67.140).
- Correct envelope domain: bounce.pivotnews.com
- SPF alignment is good enough for DMARC (relaxed mode).

**2. DKIM: PASS**
- Signed by: daily.pivotnews.com (selector: pv1)
- Alignment OK
- Signature covers important headers

**3. DMARC: PASS**
- DMARC record for pivotnews.com is detected and aligned.

**4. ARC Seals Present**
- Google is adding ARC for downstream trust.
- Helps for forwarding scenarios.

**5. RFC-Compliant Headers**
- Message-ID
- Date
- MIME-Version
- Precedence: Bulk (good for bulk delivery)
- List-Unsubscribe header
- List-Unsubscribe-Post: List-Unsubscribe=One-Click

These are essential for inbox providers like Gmail, Outlook, Yahoo.

**6. One-Click Unsubscribe**
Present and valid:
```
List-Unsubscribe: <https://app.pivotnews.com/...>
```
Required by Gmail, Yahoo (2024 policies).

**7. A Visible Postal Address**
Not required internationally but recommended — and you do provide company info at the bottom.

**8. A Proper Plain-Text Part**
Included and readable. Gmail/Yahoo requirement.

**9. Tracking Pixels & Click Tracking Are Acceptable**
Your pixel + tracked links are fine and do not violate guidelines as long as complaint rates are low.

---

### What Is Good but Should Be Improved

**1. From-domain consistency**

Your "From:" address is:
```
pivotnews@daily.pivotnews.com
```

But bounce domain is:
```
bounce.pivotnews.com
```

This is fine (both subdomains of pivotnews.com), but for maximum inbox placement providers prefer:
- From: = subdomain dedicated to marketing (e.g., news@daily.pivotnews.com)
- Return-Path: = matching domain (e.g., bounce.daily.pivotnews.com)

This increases alignment resilience and reputation separation.

**2. Heavy HTML**

Your HTML is very large (~200 KB+). Gmail clips at ~102 KB.

This email will get clipped in Gmail because:
- It loads a full multi-story newsletter
- It includes repetitive inline styles and large URLs

**Why clipping is bad:**
- People don't see your unsubscribe footer
- Increases spam complaints
- Lowers engagement signals

**Solution:** Inline CSS optimization + URL shortening + remove repeats. Goal: HTML under 90 KB.

**3. No List-ID Header**

This is optional but recommended:
```
List-ID: Pivot5 <daily.pivotnews.com>
```
This helps Gmail categorize the email as a newsletter rather than Promotion → Spam.

**4. Tracking Domain Reputations**

Your links use:
- tr.pivotnews.com (redirect/tracking domain)
- img.pivotnews.com (image CDN)

You should ensure both have:
- Good domain reputation
- Proper SSL
- DNS records (A, AAAA, CNAME)
- Matching SPF neutral (not required but reduces edge cases)

If Gmail sees mismatches between From-domain and tracking domain, it may lower trust.

**5. Preheader Exists but Is Hidden Too Hard**

Your hidden preheader works, but Gmail prefers:
- Color not equal to background (you used same color)
- More than 40–90 chars for better engagement

---

### What Is Missing or Risky

**1. No BIMI Record**

Not required but very helpful for inbox trust. Without it, you lose:
- Brand logo in Gmail
- Additional anti-spam scoring signals

You'll need:
- Verified Mark Certificate (VMC)
- SVG logo
- DNS TXT for BIMI

Given your scale, you should implement BIMI ASAP.

**2. No Feedback-ID Header (for Gmail bulk senders)**

You do have CFBL-Feedback-ID but Gmail prefers:
```
Feedback-ID: campaign:sender:12345
```
For bulk senders >5k/day, this becomes increasingly important for complaint loop handling.

**3. Potentially Large Link Encoding**

You're using extremely long redirect URLs (due to UTM + Base64 tokens). This can:
- Increase spam likelihood
- Increase HTML size
- Trigger Gmail clipping faster
- Look suspicious to Outlook

**4. High Image Count**

There are 5 large images. Best practice:
- Use compression or WebP
- Reduce number for better engagement
- Keep total image weight under 1.5 MB
- Avoid too many images early in the HTML (spam trigger)

---

### FINAL VERDICT

Your email meets all the mandatory deliverability requirements (SPF, DKIM, DMARC, List-Unsubscribe, plain text, proper MIME).

**It is fully compliant and should inbox for your core users.**

But to reach optimal deliverability for a million-subscriber newsletter, you should improve:
- HTML size (avoid Gmail clipping)
- Streamline tracking URLs
- Add List-ID and Feedback-ID
- Add BIMI for brand trust
- Ensure tracking domains have strong reputation

---

## Key Takeaways

| Item | Status | Priority | Owner |
|------|--------|----------|-------|
| First warmup email sent | Done (Dec 16) | - | Pat |
| Daily send schedule | 8:30am EST | - | Pivot5 |
| Target segment | "Warmup - all emails" | - | - |
| Image compression | To do | This week | Pivot5 |
| Reduce HTML size (<90KB) | To do | This week | Pivot5 |
| Add List-ID header | To do | This week | Pivot5 |
| SPF/DKIM/DMARC | Pass | - | - |
| One-click unsubscribe | Pass | - | - |
| BIMI setup | To do | Later | Pivot5 |
| Feedback-ID header | To do | Later | Pivot5 |

## Deliverability Checklist Summary

| Check | Status |
|-------|--------|
| SPF | PASS |
| DKIM | PASS |
| DMARC | PASS |
| List-Unsubscribe | PASS |
| Plain-text part | PASS |
| HTML size <102KB | FAIL (needs work) |
| List-ID header | Missing (recommended) |
| BIMI | Missing (optional) |
| Feedback-ID | Missing (recommended for >5k/day) |

## Contacts for This Thread

| Name | Role | Email |
|------|------|-------|
| Pierre Galiegue | Mailsoar Lead | pierre.galiegue@mailsoar.com |
| Vikas | Mailsoar Consultant (assigned) | - |
| Virginie | Mailsoar Oversight | - |
| Kunal Gupta | Pivot5 Founder | kunal@pivot5.ai / hi@kunal.live |
| Pat Simmons | Pivot5 Operator | pat@pivotstudio.ai |
