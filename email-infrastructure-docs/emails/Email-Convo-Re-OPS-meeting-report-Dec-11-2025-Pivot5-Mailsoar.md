# Email Conversation: OPS Meeting Report - Pivot5/Mailsoar (Dec 11, 2025)

> **Note:** This is an ongoing conversation. Pat will provide details as more people respond.

---

## Email Thread (Most Recent First)

---

### Kunal Gupta <kunal@pivot5.ai>
**Dec 16, 2025, 10:46 AM**
To: Pierre, Langdon, Vikas, Virginie, Pat

Thanks Pierre,

A few questions and comments:

1) Supabase updated to allow status "migrated" in "status" column of "contacts" table. Once again, any contacts Mailsoar migrates from Supabase to Mautic and marks as "status" = "migrated", our existing n8n/supabase/greenarrow sending will exclude them so those users do not receive both the old and new email.

2) In Supabase, I believe we do have additional fields with nice-to-have data about the contacts, including name, company, title, industry, city, etc. We do not plan to use any of this as personalization of the email content, however down the road, will use it for analytics. If possible to carry it over now, we might as well. Otherwise we can always run a contact data augmentation exercise later (and perhaps in a separate analytics stack).

3) The Warmy (warmy-test1) segment - should that also be included in the daily Pivot 5 HTML newsletter? I imagine we want those warm up email boxes to receive the same email, that way we are generating clicks to our domain (as the links in the newsletter go to content on pivotnews.com)? So does that mean they should be added as a segment to the daily email?

Kunal

---

### Pierre Galiegue <pierre.galiegue@mailsoar.com>
**Dec 16, 2025, 3:02 PM**

Hey Kunal,

We have enabled the warmup on our end.

You have one main segment named "Warmup - all emails" that can be used daily and on which we will add new contacts daily (in addition to existing ones).

We also flag each contact using the custom field "Lot Import" that contains the day of the import, for example today: "warmup_2025-12-16".
This way you have the ability to either target the whole migrated list OR segment only the contacts migrated on a specific day.

We also want to flag in your Supabase the emails that have been migrated by changing the status from "active" to "migrated".
However, there is currently a CHECK constraint on the status column that only allows "active", "engaged", and "unsubscribed" values.

Could you please add "migrated" to the allowed values? Here is the SQL query to run in your Supabase SQL editor:
```sql
ALTER TABLE contacts DROP CONSTRAINT contacts_status_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_status_check CHECK (status IN ('active', 'engaged', 'unsubscribed', 'migrated'));
```

Let me know once it's done and we'll update the migrated contacts accordingly.

Best,

---

### Kunal Gupta <kunal@pivot5.ai>
**Dec 16, 2025, 2:35 PM**

Hi Pierre,

Last week we were able to get the API to work to send the campaign (the same one I forwarded to you), so we are good to go.

Should we be sending to a specific segment/label (that you'll add contacts to regularly)?

Or is there some other way to manage the warmup?

Kunal

---

### Pierre Galiegue <pierre.galiegue@mailsoar.com>
**Dec 16, 2025, 12:01 PM**

Hi Team,

I wanted to check whether the automated sends and campaign creation have now been fully finalized on your side. We are currently waiting on this in order to begin the warm-up process. Could you please share an ETA for when this will be ready?

For your information, since last Friday we have been sending daily to your Warmy.io seed list.

Please also note that I will be on vacation from December 22nd to January 5th. Vikas will be taking over the project during this period. However, ideally, I would like us to start the warm-up before my vacation.

Best regards,

---

### Kunal Gupta <kunal@pivot5.ai>
**Dec 12, 2025, 7:58 AM**

Hi Pierre,

I have done this - you should be able to start the warm up.

Let's focus on the sending domain daily.pivotnews.com as we'll send Pivot 5 from that.

Kunal

---

### Pierre Galiegue <pierre.galiegue@mailsoar.com>
**Dec 11, 2025, 4:56 PM**

Hi Kunal,

Yes, we can start with only one sender on both seeds at Gmail and Outlook.

Best

---

### Kunal Gupta <kunal@pivot5.ai>
**Dec 11, 2025, 4:59 PM**

Hi Pierre,

Here is the login for Warmy

Should we just do 1 sender to start with, and sign up for both Gmail and Outlook?

[image.png - Warmy.io interface screenshot]

---

### Pierre Galiegue <pierre.galiegue@mailsoar.com>
**Dec 11, 2025, 3:35 PM**

Hey,

Thank you for joining today's meeting.
Please find your report attached as well as a summary of pending tasks:

**Mailsoar**
- Contact Postmastery to ensure DMARC reporting is configured for new subdomains as well
- Develop and share Mautic API example for creating email templates, associating campaigns with segments, and sending automatically
- Investigate Mautic server performance and UI issues impacting save/send functionality and report findings
- Adjust contact database to use "status" field for migrating contacts as "migrated"

**Pivot5**
- Test Mautic API for email creation, sending, and report issues

Regarding the third party tool mentioned "Warmy.io", please follow this instructions:
- Create an account here: https://www.warmy.io/signup
- Select the plan "Seedlist" (1,000 seed) at Gmail with 4 sender (one for each subdomain)
- Share credentials with us

Best regards

---

## Key Takeaways

| Item | Status | Owner |
|------|--------|-------|
| Supabase `migrated` status constraint | Done | Kunal |
| Warmup segment "Warmup - all emails" | Active | Mailsoar |
| Lot Import custom field (e.g., `warmup_2025-12-16`) | Active | Mailsoar |
| Warmy.io seed list daily sends | Active since Dec 13 | Mailsoar |
| Mautic API integration | Working | Pivot5 |
| Sending domain focus | `daily.pivotnews.com` | - |
| Pierre vacation | Dec 22 - Jan 5 | Vikas covering |

## Open Questions (from Kunal's Dec 16 email)

1. Should Warmy (warmy-test1) segment be included in daily Pivot 5 HTML newsletter?
2. Should contact metadata (name, company, title, industry, city) be migrated now or later?
