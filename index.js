require('dotenv').config();
const { BskyAgent, RichText } = require('@atproto/api');
const RSSParser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const rssParser = new RSSParser();

// File to store the last post's GUID
const LAST_POST_FILE = 'last_post.json';

// Fetch the last post GUID
function getLastPostGUID() {
    try {
        const data = fs.readFileSync(LAST_POST_FILE);
        return JSON.parse(data).guid || null;
    } catch (err) {
        return null;
    }
}

// Update the last post GUID
function updateLastPostGUID(guid) {
    fs.writeFileSync(LAST_POST_FILE, JSON.stringify({ guid }), 'utf-8');
}

// Fetch RSS feed and extract necessary data
async function fetchRSSFeed() {
    const feed = await rssParser.parseURL(process.env.RSS_FEED_URL);
    console.log("Fetched RSS feed items:", feed.items);

    // Extract all items from the feed
    return feed.items.map(item => {
        const $ = cheerio.load(item.content);
        const image = $('img').attr('src'); // Extract the image URL

        return {
            title: item.title,
            link: item.link,
            contentSnippet: item.contentSnippet,
            image: image || null, // Return null if no image found
            guid: item.guid, // Unique GUID to prevent duplicates
        };
    });
}

// Convert image URL to raw binary data (Buffer)
async function downloadImage(url) {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'arraybuffer',
    });
    return response.data;
}

async function sendPost() {
    const agent = new BskyAgent({ service: "https://bsky.social" });

    // Log in to Bluesky
    await agent.login({
        identifier: process.env.BLUESKY_USERNAME,
        password: process.env.BLUESKY_PASSWORD,
    });

    const items = await fetchRSSFeed();
    const lastPostedGUID = getLastPostGUID();

    let mostRecentPostGUID = lastPostedGUID;

    for (const { title, link, contentSnippet, image, guid } of items) {
        // Skip posts that have already been published
        if (lastPostedGUID === guid) {
            console.log(`Already posted: ${title}`);
            break;
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
                        uri: link,
                        title: title,
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
            embed,
        });

        // Update the most recent GUID
        mostRecentPostGUID = guid;
        console.log("Post sent successfully:", title);
    }

    // Update the last post GUID in the file after all posts have been handled
    updateLastPostGUID(mostRecentPostGUID);
}

sendPost().catch(console.error);
