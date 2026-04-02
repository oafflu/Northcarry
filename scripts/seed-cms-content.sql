-- Seed CMS Content with existing website content
-- This script populates the cms_content table with the current content from the website

-- Privacy Policy
INSERT INTO cms_content (section, content, updated_at)
VALUES (
  'privacy',
  jsonb_build_object(
    'title', 'Privacy Policy',
    'content', '<div>
  <p class="text-sm text-gray-500 mb-4">Last updated: January 2025</p>

  <section>
    <h2 class="text-2xl font-semibold text-gray-900 mb-4">1. Information We Collect</h2>
    <p class="text-gray-600 mb-4">
      We collect information that you provide directly to us, including:
    </p>
    <ul class="list-disc list-inside text-gray-600 space-y-2 ml-4">
      <li>Name, email address, and contact information</li>
      <li>Shipping and billing addresses</li>
      <li>Payment information (processed securely through our payment providers)</li>
      <li>Order history and preferences</li>
      <li>Account credentials and profile information</li>
    </ul>
  </section>

  <section>
    <h2 class="text-2xl font-semibold text-gray-900 mb-4">2. How We Use Your Information</h2>
    <p class="text-gray-600 mb-4">We use the information we collect to:</p>
    <ul class="list-disc list-inside text-gray-600 space-y-2 ml-4">
      <li>Process and fulfill your orders</li>
      <li>Send you order confirmations and shipping updates</li>
      <li>Respond to your customer service requests</li>
      <li>Send you marketing communications (with your consent)</li>
      <li>Improve our website and services</li>
      <li>Prevent fraud and ensure security</li>
    </ul>
  </section>

  <section>
    <h2 class="text-2xl font-semibold text-gray-900 mb-4">3. Information Sharing</h2>
    <p class="text-gray-600">
      We do not sell your personal information. We may share your information with:
    </p>
    <ul class="list-disc list-inside text-gray-600 space-y-2 ml-4 mt-2">
      <li>Payment processors to complete transactions</li>
      <li>Shipping carriers to deliver your orders</li>
      <li>Service providers who assist in our operations</li>
      <li>Legal authorities when required by law</li>
    </ul>
  </section>

  <section>
    <h2 class="text-2xl font-semibold text-gray-900 mb-4">4. Data Security</h2>
    <p class="text-gray-600">
      We implement appropriate security measures to protect your personal information. 
      However, no method of transmission over the internet is 100% secure. While we strive 
      to protect your data, we cannot guarantee absolute security.
    </p>
  </section>

  <section>
    <h2 class="text-2xl font-semibold text-gray-900 mb-4">5. Your Rights</h2>
    <p class="text-gray-600 mb-4">You have the right to:</p>
    <ul class="list-disc list-inside text-gray-600 space-y-2 ml-4">
      <li>Access your personal information</li>
      <li>Correct inaccurate information</li>
      <li>Request deletion of your information</li>
      <li>Opt-out of marketing communications</li>
      <li>Request a copy of your data</li>
    </ul>
  </section>

  <section>
    <h2 class="text-2xl font-semibold text-gray-900 mb-4">6. Cookies</h2>
    <p class="text-gray-600">
      We use cookies to enhance your browsing experience, analyze site traffic, and 
      personalize content. You can control cookies through your browser settings.
    </p>
  </section>

  <section>
    <h2 class="text-2xl font-semibold text-gray-900 mb-4">7. Contact Us</h2>
    <p class="text-gray-600">
      If you have questions about this Privacy Policy, please contact us at:
    </p>
    <p class="text-gray-600 mt-2">
      Email: <a href="mailto:hello@brevibrushes.com" class="text-teal-600 hover:text-teal-700">hello@brevibrushes.com</a>
    </p>
  </section>
</div>'
  ),
  NOW()
)
ON CONFLICT (section) DO UPDATE SET
  content = EXCLUDED.content,
  updated_at = NOW();

-- Terms of Service
INSERT INTO cms_content (section, content, updated_at)
VALUES (
  'terms',
  jsonb_build_object(
    'title', 'Terms of Service',
    'content', '<div>
  <p class="text-sm text-gray-500 mb-4">Last updated: January 2025</p>

  <section>
    <h2 class="text-2xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
    <p class="text-gray-600">
      By accessing and using the BREVI website, you accept and agree to be bound by the 
      terms and provision of this agreement. If you do not agree to these terms, please 
      do not use our website.
    </p>
  </section>

  <section>
    <h2 class="text-2xl font-semibold text-gray-900 mb-4">2. Use License</h2>
    <p class="text-gray-600 mb-4">
      Permission is granted to temporarily access the materials on BREVI''s website for 
      personal, non-commercial transitory viewing only. This is the grant of a license, 
      not a transfer of title, and under this license you may not:
    </p>
    <ul class="list-disc list-inside text-gray-600 space-y-2 ml-4">
      <li>Modify or copy the materials</li>
      <li>Use the materials for any commercial purpose</li>
      <li>Attempt to decompile or reverse engineer any software</li>
      <li>Remove any copyright or other proprietary notations</li>
    </ul>
  </section>

  <section>
    <h2 class="text-2xl font-semibold text-gray-900 mb-4">3. Product Information</h2>
    <p class="text-gray-600">
      We strive to provide accurate product descriptions and pricing. However, we do not 
      warrant that product descriptions or other content on this site is accurate, complete, 
      reliable, current, or error-free. Prices and availability are subject to change 
      without notice.
    </p>
  </section>

  <section>
    <h2 class="text-2xl font-semibold text-gray-900 mb-4">4. Orders and Payment</h2>
    <p class="text-gray-600 mb-4">
      By placing an order, you agree to provide accurate and complete information. 
      We reserve the right to refuse or cancel any order for any reason, including:
    </p>
    <ul class="list-disc list-inside text-gray-600 space-y-2 ml-4">
      <li>Product availability</li>
      <li>Errors in pricing or product information</li>
      <li>Fraudulent or illegal transactions</li>
      <li>Technical errors</li>
    </ul>
  </section>

  <section>
    <h2 class="text-2xl font-semibold text-gray-900 mb-4">5. User Accounts</h2>
    <p class="text-gray-600">
      You are responsible for maintaining the confidentiality of your account and password. 
      You agree to accept responsibility for all activities that occur under your account.
    </p>
  </section>

  <section>
    <h2 class="text-2xl font-semibold text-gray-900 mb-4">6. Limitation of Liability</h2>
    <p class="text-gray-600">
      BREVI shall not be liable for any indirect, incidental, special, consequential, or 
      punitive damages resulting from your use of or inability to use the service.
    </p>
  </section>

  <section>
    <h2 class="text-2xl font-semibold text-gray-900 mb-4">7. Governing Law</h2>
    <p class="text-gray-600">
      These terms shall be governed by and construed in accordance with the laws of the 
      State of Texas, United States, without regard to its conflict of law provisions.
    </p>
  </section>

  <section>
    <h2 class="text-2xl font-semibold text-gray-900 mb-4">8. Contact Information</h2>
    <p class="text-gray-600">
      If you have any questions about these Terms of Service, please contact us:
    </p>
    <p class="text-gray-600 mt-2">
      Email: <a href="mailto:hello@brevibrushes.com" class="text-teal-600 hover:text-teal-700">hello@brevibrushes.com</a>
    </p>
  </section>
</div>'
  ),
  NOW()
)
ON CONFLICT (section) DO UPDATE SET
  content = EXCLUDED.content,
  updated_at = NOW();

-- Refund Policy
INSERT INTO cms_content (section, content, updated_at)
VALUES (
  'refund',
  jsonb_build_object(
    'title', 'Refund Policy',
    'content', '<div>
  <p class="text-sm text-gray-500 mb-4">Last updated: January 2025</p>

  <section>
    <h2 class="text-2xl font-semibold text-gray-900 mb-4">5 Days Replacement Policy</h2>
    <p class="text-gray-600">
      We stand behind the quality of our products. If you receive a defective or damaged Brevi brush, 
      you can request a replacement within 5 days of delivery. We will arrange for a replacement 
      to be sent to you at no additional cost.
    </p>
  </section>

  <section>
    <h2 class="text-2xl font-semibold text-gray-900 mb-4">Replacement Eligibility</h2>
    <p class="text-gray-600 mb-4">To be eligible for a replacement:</p>
    <ul class="list-disc list-inside text-gray-600 space-y-2 ml-4">
      <li>Item must be defective or damaged upon arrival</li>
      <li>Replacement request must be initiated within 5 days of delivery</li>
      <li>Original proof of purchase is required</li>
      <li>Photos of the defect or damage may be required</li>
    </ul>
  </section>

  <section>
    <h2 class="text-2xl font-semibold text-gray-900 mb-4">How to Request a Replacement</h2>
    <ol class="list-decimal list-inside text-gray-600 space-y-2 ml-4">
      <li>Contact us at hello@brevibrushes.com within 5 days of delivery</li>
      <li>Provide your order number and describe the issue</li>
      <li>Send photos of the defect or damage if requested</li>
      <li>We will review your request and arrange for a replacement to be shipped</li>
      <li>You will receive tracking information once the replacement is dispatched</li>
    </ol>
  </section>

  <section>
    <h2 class="text-2xl font-semibold text-gray-900 mb-4">Replacement Processing</h2>
    <p class="text-gray-600 mb-4">
      Once we approve your replacement request:
    </p>
    <ul class="list-disc list-inside text-gray-600 space-y-2 ml-4">
      <li>Replacement will be shipped within 2-3 business days</li>
      <li>You will receive tracking information via email</li>
      <li>Replacement shipping is free of charge</li>
      <li>You may be asked to return the defective item (return shipping will be provided)</li>
    </ul>
  </section>

  <section>
    <h2 class="text-2xl font-semibold text-gray-900 mb-4">Defective or Damaged Items</h2>
    <p class="text-gray-600">
      If you receive a defective or damaged Brevi brush, please contact us immediately at 
      <a href="mailto:hello@brevibrushes.com" class="text-teal-600 hover:text-teal-700"> hello@brevibrushes.com</a> 
      or use our live chat feature. We will arrange for a replacement to be sent to you, including return shipping costs if needed.
    </p>
  </section>

  <section>
    <h2 class="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
    <p class="text-gray-600">
      For questions about returns or refunds, please contact us:
    </p>
    <p class="text-gray-600 mt-2">
      Email: <a href="mailto:hello@brevibrushes.com" class="text-teal-600 hover:text-teal-700">hello@brevibrushes.com</a>
    </p>
  </section>
</div>'
  ),
  NOW()
)
ON CONFLICT (section) DO UPDATE SET
  content = EXCLUDED.content,
  updated_at = NOW();

-- FAQ
INSERT INTO cms_content (section, content, updated_at)
VALUES (
  'faq',
  jsonb_build_object(
    'title', 'Frequently Asked Questions',
    'questions', jsonb_build_array(
      jsonb_build_object(
        'category', 'Shipping & Delivery',
        'question', 'How long does shipping take?',
        'answer', 'Standard shipping typically takes 5-7 business days. Express shipping is available for 2-3 business day delivery.'
      ),
      jsonb_build_object(
        'category', 'Shipping & Delivery',
        'question', 'Do you ship internationally?',
        'answer', 'Currently, we ship within the United States. International shipping options are coming soon.'
      ),
      jsonb_build_object(
        'category', 'Returns & Refunds',
        'question', 'What is your return policy?',
        'answer', 'We offer a 5-day replacement policy for defective or damaged Brevi brushes. If you receive a defective item, contact us within 5 days of delivery and we''ll send you a replacement at no cost.'
      ),
      jsonb_build_object(
        'category', 'Returns & Refunds',
        'question', 'How do I request a replacement?',
        'answer', 'Contact our customer service team at hello@brevibrushes.com within 5 days of delivery. Provide your order number and photos of the defect or damage, and we''ll arrange for a replacement.'
      ),
      jsonb_build_object(
        'category', 'Product Information',
        'question', 'Are your toothbrushes eco-friendly?',
        'answer', 'Yes! Our bamboo toothbrushes are made from sustainable bamboo and biodegradable materials. We''re committed to environmental sustainability.'
      ),
      jsonb_build_object(
        'category', 'Product Information',
        'question', 'How often should I replace my toothbrush?',
        'answer', 'Dentists recommend replacing your toothbrush every 3-4 months, or sooner if the bristles become frayed.'
      ),
      jsonb_build_object(
        'category', 'Orders & Payments',
        'question', 'What payment methods do you accept?',
        'answer', 'We accept all major credit cards, PayPal, and other secure payment methods through our checkout system.'
      ),
      jsonb_build_object(
        'category', 'Orders & Payments',
        'question', 'Can I track my order?',
        'answer', 'Yes! Once your order ships, you''ll receive a tracking number via email. You can also track your order in your account dashboard.'
      )
    )
  ),
  NOW()
)
ON CONFLICT (section) DO UPDATE SET
  content = EXCLUDED.content,
  updated_at = NOW();

-- Checkout Content
INSERT INTO cms_content (section, content, updated_at)
VALUES (
  'checkout',
  jsonb_build_object(
    'title', 'Checkout',
    'subtitle', 'Complete your purchase',
    'trustBadges', jsonb_build_array(
      jsonb_build_object('text', 'Secure Payment', 'icon', '🔒'),
      jsonb_build_object('text', 'Free Shipping', 'icon', '🚚'),
      jsonb_build_object('text', 'Easy Returns', 'icon', '↩️')
    )
  ),
  NOW()
)
ON CONFLICT (section) DO UPDATE SET
  content = EXCLUDED.content,
  updated_at = NOW();

