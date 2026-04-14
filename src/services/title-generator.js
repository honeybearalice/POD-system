/**
 * Smart SEO title generator for POD products.
 * Template-based with style detection from tags/filename.
 */

const STYLES = ['Funny', 'Cute', 'Vintage', 'Retro', 'Minimalist', 'Boho', 'Floral', 'Abstract',
  'Geometric', 'Watercolor', 'Cartoon', 'Motivational', 'Inspirational', 'Trendy', 'Aesthetic'];

const AUDIENCES = ['Men', 'Women', 'Kids', 'Boys', 'Girls', 'Teens', 'Mom', 'Dad',
  'Grandma', 'Grandpa', 'Dog Lover', 'Cat Lover', 'Teacher', 'Nurse', 'Engineer'];

const OCCASIONS = ['Birthday', 'Christmas', 'Valentine\'s Day', 'Mother\'s Day', 'Father\'s Day',
  'Graduation', 'Anniversary', 'Halloween', 'Easter', 'Thanksgiving', 'Back to School'];

const PRODUCTS = {
  'tshirt': ['T-Shirt', 'Tee', 'Shirt'],
  'mug': ['Coffee Mug', 'Mug', 'Cup'],
  'phone-case': ['Phone Case', 'iPhone Case', 'Samsung Case'],
  'poster': ['Wall Art', 'Poster', 'Print'],
  'tote-bag': ['Tote Bag', 'Canvas Bag', 'Shopping Bag'],
};

function detectStyle(filename, tags) {
  const text = `${filename} ${(tags || []).join(' ')}`.toLowerCase();
  return STYLES.find(s => text.includes(s.toLowerCase())) || STYLES[Math.floor(Math.random() * STYLES.length)];
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateTitle(options = {}) {
  const { templateName, filename, tags, platform } = options;
  const style = detectStyle(filename || '', tags);
  const productKey = templateName || 'tshirt';
  const productNames = PRODUCTS[productKey] || PRODUCTS['tshirt'];
  const product = pickRandom(productNames);
  const audience = pickRandom(AUDIENCES);
  const occasion = pickRandom(OCCASIONS);

  // Platform-specific title patterns
  const patterns = [
    `${style} ${product} for ${audience} - ${occasion} Gift`,
    `${style} Design ${product} - Perfect Gift for ${audience}`,
    `${occasion} ${product} - ${style} ${audience} Gift Idea`,
    `${style} ${audience} ${product} - Unique ${occasion} Present`,
  ];

  let title = pickRandom(patterns);

  // Platform length limits
  if (platform === 'temu' && title.length > 120) title = title.substring(0, 117) + '...';
  if (platform === 'amazon' && title.length > 200) title = title.substring(0, 197) + '...';
  if (platform === 'etsy' && title.length > 140) title = title.substring(0, 137) + '...';

  // Generate tags
  const genTags = [style.toLowerCase(), product.toLowerCase().replace(/\s+/g, ''),
    audience.toLowerCase(), occasion.toLowerCase().replace(/'/g, ''),
    'pod', 'printOnDemand', 'customGift', `${style.toLowerCase()}design`];

  return { title, tags: genTags, style, product: productKey };
}

function generateDescription(options = {}) {
  const { title, style, product } = options;
  return `${title}\n\nThis unique ${style || 'custom'} design makes the perfect gift! High-quality print that won't fade. Available in multiple sizes.\n\n- Premium quality print\n- Vibrant colors that last\n- Perfect gift for any occasion\n- Unique design you won't find anywhere else`;
}

module.exports = { generateTitle, generateDescription };
