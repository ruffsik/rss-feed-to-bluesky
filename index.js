require('dotenv').config();
const { BskyAgent, RichText } = require('@atproto/api');
const RSSParser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');

const rssParser = new RSSParser();
const fs = require('fs');

// File to store the last post's GUID
const LAST_POST_FILE = 'last_post.json';

// Function to fetch the last post GUID from the file
function getLastPostGUID() {
    try {
        const data = fs.readFileSync(LAST_POST_FILE);
        return JSON.parse(data).guid || null;
    } catch (err) {
        return null;
    }
}

// Function to update the last post GUID in the file
function updateLastPostGUID(guid) {
    fs.writeFileSync(LAST_POST_FILE, JSON.stringify({ guid }), 'utf-8');
}

// Fetch RSS feed and extract necessary data
async function fetchRSSFeed() {
    const feed = await rssParser.parseURL(process.env.RSS_FEED_URL);
    const latestArticle = feed.items[0];

    console.log("Latest article feed item:", latestArticle);

    // Extract the image from the <description> field
    if (latestArticle.content) {
        const $ = cheerio.load(latestArticle.content);
        const image = $('img').attr('src'); // Extract the image URL

        return {
            title: latestArticle.title,
            link: latestArticle.link,
            contentSnippet: latestArticle.contentSnippet,
            image: image || null, // Return null if no image found
            guid: latestArticle.guid // We need the unique GUID to prevent duplicates
        };
    } else {
        console.error("No content available for the article");
        return {
            title: latestArticle.title,
            link: latestArticle.link,
            contentSnippet: latestArticle.contentSnippet,
            image: 'https://i.imgur.com/RuONxjF.png', // Placeholder image
        };
    }
}

// Convert image URL to raw binary data (Buffer)
async function downloadImage(url) {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'arraybuffer', // This will return raw binary data
    });
    return response.data; // Return raw image buffer directly
}

async function sendPost() {
    const agent = new BskyAgent({ service: "https://bsky.social" });

    // Log in to Bluesky
    await agent.login({
        identifier: process.env.BLUESKY_USERNAME,
        password: process.env.BLUESKY_PASSWORD,
    });

    const { title, link, contentSnippet, image, guid } = await fetchRSSFeed();

    if (!title || !link || !guid) {
        console.error("Missing title, link, or GUID for the post.");
        return;
    }

    const lastPostedGUID = getLastPostGUID();

        // If the latest post is the same as the last posted, skip posting
        if (lastPostedGUID === guid) {
            console.log("No new posts to publish.");
            return;
        }

    let embed = null;

    if (image) {
        try {
            // Download the image as a buffer (raw binary data)
            const imageBuffer = await downloadImage(image);
    
            // Upload the image buffer as raw binary data
            const imageBlob = await agent.uploadBlob(imageBuffer, { encoding: 'image/jpeg' });

            embed = {
                $type: 'app.bsky.embed.external',
                external: {
                    uri: link,         // Article link
                    title: title,      // Article title
                    description: contentSnippet,
                    thumb: imageBlob.data.blob,
                    },
            };
        } catch (err) {
            console.error("Error downloading or uploading image:", err);
        }
    }

    const richText = new RichText({ text: `${contentSnippet}` });
    await richText.detectFacets(agent);

    // Send the post with text and optional external embed (website card)
    await agent.post({
        text: richText.text,
        facets: richText.facets,
        embed,  // Attach the website card embed
    });

        // Update the last post GUID
        updateLastPostGUID(guid);

    console.log("Post sent successfully!");
}

sendPost().catch(console.error);
