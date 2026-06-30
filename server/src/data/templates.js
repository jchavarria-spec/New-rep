// System email templates for common real estate scenarios.
// Bodies are HTML and support {{merge}} fields:
//   {{first_name}} {{last_name}} {{agent_name}} {{brokerage}}
//   {{property_address}} {{price}} {{open_house_time}}

export const systemTemplates = [
  {
    scenario: "new_listing",
    name: "New Listing Announcement",
    subject: "Just Listed: {{property_address}}",
    body: `
<h2>Just Listed 🏡</h2>
<p>Hi {{first_name}},</p>
<p>I'm excited to share a brand-new listing that just hit the market:</p>
<p style="font-size:18px"><strong>{{property_address}}</strong><br/>Offered at <strong>{{price}}</strong></p>
<p>Homes like this move quickly. If you'd like a private showing or the full
property details, just reply to this email and I'll set it up right away.</p>
<p>Warmly,<br/>{{agent_name}}<br/>{{brokerage}}</p>`,
  },
  {
    scenario: "follow_up",
    name: "Buyer Follow-Up",
    subject: "Following up on your home search, {{first_name}}",
    body: `
<h2>Still here to help 👋</h2>
<p>Hi {{first_name}},</p>
<p>I wanted to check in on your home search. The market is shifting and a few
new properties just came up that match what you're looking for.</p>
<p>Would you have 15 minutes this week for a quick call? I'd love to make sure
you're first in line when the right home appears.</p>
<p>Best,<br/>{{agent_name}}<br/>{{brokerage}}</p>`,
  },
  {
    scenario: "open_house",
    name: "Open House Invitation",
    subject: "You're invited: Open House at {{property_address}}",
    body: `
<h2>Open House This Weekend 🚪</h2>
<p>Hi {{first_name}},</p>
<p>Come see <strong>{{property_address}}</strong> in person!</p>
<p><strong>When:</strong> {{open_house_time}}<br/>
<strong>Price:</strong> {{price}}</p>
<p>Stop by, tour the home, and let's talk about whether it's the right fit.
Light refreshments will be served.</p>
<p>See you there,<br/>{{agent_name}}<br/>{{brokerage}}</p>`,
  },
  {
    scenario: "price_drop",
    name: "Price Improvement Alert",
    subject: "Price Improved on {{property_address}}",
    body: `
<h2>Great News — Price Improved 📉</h2>
<p>Hi {{first_name}},</p>
<p>The price on <strong>{{property_address}}</strong> was just improved to
<strong>{{price}}</strong>. This is a fantastic opportunity in today's market.</p>
<p>Reply to schedule a tour before someone else does.</p>
<p>Talk soon,<br/>{{agent_name}}<br/>{{brokerage}}</p>`,
  },
  {
    scenario: "just_sold",
    name: "Just Sold — Neighborhood Update",
    subject: "Just Sold near you — what's your home worth?",
    body: `
<h2>Just Sold in Your Neighborhood 🎉</h2>
<p>Hi {{first_name}},</p>
<p>I just helped a family close on a home near you. Inventory is low and buyers
are active — which means it may be a great time to find out what your home is
worth.</p>
<p>Want a free, no-obligation home valuation? Just reply "VALUE" and I'll send
one over.</p>
<p>Cheers,<br/>{{agent_name}}<br/>{{brokerage}}</p>`,
  },
  {
    scenario: "past_client",
    name: "Past Client Check-In",
    subject: "Thinking of you, {{first_name}}",
    body: `
<h2>Happy to reconnect 💛</h2>
<p>Hi {{first_name}},</p>
<p>It's been a little while since we worked together and I wanted to say hello.
How are you enjoying the home?</p>
<p>If you ever need a contractor referral, a market update, or have friends
looking to buy or sell, I'm always just an email away.</p>
<p>Warm regards,<br/>{{agent_name}}<br/>{{brokerage}}</p>`,
  },
];
