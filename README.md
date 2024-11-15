
![RSS to Bluesky Header Image](https://i.imgur.com/T75iT1q.png)

# rss-feed-to-bluesky
Fetch RSS feed items with `node.js` to post on Bluesky (News with website card embeds)

## Setup
1. Install node.js
```
npm init
```

2. Install clients
```
npm install @atproto/api
npm install rss-parser
npm install axios
npm install cheerio
npm install fs
npm install dotenv
```

## Create `.env`-file and fill in your informations
```
RSS_FEED_URL=       // your rss feed
BLUESKY_USERNAME=   // your bluesky username
BLUESKY_PASSWORD=   // your password
```

## Customizing the code
* Depending on the structure of the rss feed, there need changes to be made to extract the image URL
* Change the fetched items to be used in the code
```
        return {
            title: latestArticle.title,
            link: latestArticle.link,
            contentSnippet: latestArticle.contentSnippet,
            image: image || null, 
            guid: latestArticle.guid 
        };
```
* Change the output
```
    const richText = new RichText({ text: `${contentSnippet}` });
```
