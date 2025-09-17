const express = require('express');
const router = express.Router();
require('dotenv').config();
const querystring = require('querystring');
const axios = require('axios');
const { access } = require('fs');

const scopes = [
    'user-read-currently-playing',
    'user-read-playback-state',
    'user-top-read',
    'user-read-recently-played',
    'user-modify-playback-state',
    'playlist-modify-public',
    'playlist-modify-private'
]

router.get('/', (req, res) => {
    res.status(200).send("Welcome to your Spotify Tracker!");
});

router.get('/login', (req, res) => {

    const authUrl = 'https://accounts.spotify.com/authorize?' + querystring.stringify({
        response_type: 'code',
        client_id: process.env.SPOTIFY_CLIENT_ID,
        scope: scopes.join(' '),
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI
    });

    res.redirect(authUrl);
});

router.get('/callback', async (req, res) => {
    const code = req.query.code;

    if (!code) {
        return res.status(400).send("No code found in query.");
    }

    const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET).toString('base64'),
        },
        data: querystring.stringify({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
        }),
    };

    try {
        const response = await axios(authOptions);

        const access_token = response.data.access_token;
        const refresh_token = response.data.refresh_token;
        const expires_in = response.data.expires_in;

        res.redirect("/?access_token=" + access_token + '&refresh_token=' + refresh_token + "&expires_in=" + expires_in);
    } catch (error) {
        console.error("Error getting tokens:", error.response?.data || error.message);
        res.status(500).send('Error getting tokens.');
    }
});

router.get('/currently-playing', async (req, res) => {
    const accessToken = req.headers.authorization?.split(' ')[1];

    if (!accessToken) {
        return res.status(401).send('No access token.');
    }

    try {
        const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (response.status === 204) {
            return res.json({ playing: false });
        }
        const item = response.data.item;
        res.json({
            playing: true,
            artist: item.album.artists[0]?.name || "Unknown Artist",
            song: item.name || "Unknown Song",
            album: item.album.name || "Unknown Album",
            albumImage: item.album.images[0]?.url || null // add album art URL here
        });
    } catch (error) {
        console.error(error.response?.data || error.message);
        res.status(500).send('Error fetching currently playing track.');
    }
});

router.get('/top-artists', async (req, res) => {
    const accessToken = req.headers.authorization?.split(' ')[1];

    if (!accessToken) {
        return res.status(401).send("No access token.");
    }

    try {
        const response = await axios.get('https://api.spotify.com/v1/me/top/artists', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const artists = response.data.items.map(artist => ({
            name: artist.name,
            genres: artist.genres,
            image: artist.images[0]?.url || null
        }));

        res.json(artists);
    } catch (error) {
        console.error(error.response?.data || error.message);
        res.status(500).send("Error fetching top artists.");
    }
});

router.get('/top/tracks', async (req, res) => {
    const accessToken = req.headers.authorization?.split(' ')[1];

    if (!accessToken) {
        return res.status(401).send('No access token.');
    }

    try {
        const response = await axios.get('https://api.spotify.com/v1/me/top/tracks', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const tracks = response.data.items.map(track => ({
            name: track.name,
            artists: track.artists.map(artist => artist.name).join(', '),
            albumImage: track.album.images[0]?.url || null,
            previewUrl: track.preview_url || null
        }));

        res.json(tracks);
    } catch (error) {
        console.error(error.response?.data || error.message);
        res.status(500).send("Error fetching top tracks.");
    }
});

router.get('/recently-played', async (req, res) => {
    const accessToken = req.headers.authorization?.split(' ')[1];

    if (!accessToken) {
        return res.status(401).send('No access token.');
    }

    try {
        const response = await axios.get('https://api.spotify.com/v1/me/player/recently-played?limit=50', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const tracks = response.data.items.map(item => ({
            name: item.track.name,
            artists: item.track.artists.map(artist => artist.name).join(', '),
            albumImage: item.track.album.images[0]?.url || null,
            playedAt: item.played_at
        }));

        res.json(tracks);
    } catch (error) {
        console.error(error.response?.data || error.message);
        res.status(500).send("Error fetching recent tracks.");
    }
})

router.put('/play', async (req, res) => {
    const accessToken = req.headers.authorization?.split(' ')[1];
    if (!accessToken) {
        return res.status(401).send("No access token.");
    }

    try {
        const response = await axios.put('https://api.spotify.com/v1/me/player/play', {}, {
            headers: { Authorization: `Bearer ${accessToken} ` }
        });
        res.sendStatus(204);
    } catch (error) {
        console.error(error.response?.data || error.message);
        res.status(500).send('Error playing track.')
    }
});

router.put('/pause', async (req, res) => {
    const accessToken = req.headers.authorization?.split(' ')[1];
    if (!accessToken) {
        return res.status(401).send("No access token.");
    }

    try {
        const response = await axios.put('https://api.spotify.com/v1/me/player/pause', {}, {
            headers: { Authorization: `Bearer ${accessToken} ` }
        });
        res.sendStatus(204);
    } catch (error) {
        console.error(error.response?.data || error.message);
        res.status(500).send("Error pausing track");
    }
});

router.post('/next', async (req, res) => {
    const accessToken = req.headers.authorization?.split(' ')[1];
    if (!accessToken) {
        return res.status(401).send('No access Token');
    }

    try {
        const response = await axios.post('https://api.spotify.com/v1/me/player/next', {}, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        res.sendStatus(204);
    } catch (error) {
        console.error(error.response?.data || error.message);
        res.status(500).send('Error skipping track.')
    }
});

router.post('/previous', async (req, res) => {
    const accessToken = req.headers.authorization?.split(' ')[1];
    if (!accessToken) {
        return res.status(401).send("No access token.");
    }

    try {
        const response = await axios.post('https://api.spotify.com/v1/me/player/previous', {}, {
            headers: { Authorization: `Bearer ${accessToken} ` }
        });
        res.sendStatus(204)
    } catch (error) {
        console.error(error.response?.data || error.message);
        res.status(500).send('Error skipping to previous track.');
    }
});

module.exports = router;