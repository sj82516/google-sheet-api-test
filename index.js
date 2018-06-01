const axios = require("axios");

// 中文也可以
const sheet = "sheet1";
const {spreadsheet_id, refresh_token} = require("./config");


// refresh google api token
function refreshToken() {
    return axios.post("https://developers.google.com/oauthplayground/refreshAccessToken", {
        refresh_token: refresh_token,
        token_uri: "https://www.googleapis.com/oauth2/v4/token"
    })
}

// read 
function readSheet() {
    return axios.get(encodeURI(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}/values/${sheet}!A:A?majorDimension=ROWS`))
}

// append Data
function appendSheet() {
    return axios.post(encodeURI(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}/values/${sheet}!A:A:append?valueInputOption=RAW`), {
        "values": [
            ["測試", 123, 222]
        ]
    })
}

async function main() {
    try {
        let res = await refreshToken();
        let accessToken = res.data.access_token;
        console.log("accessToken", accessToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        res = await readSheet();
        console.log("read from sheet", res.data);
        res = await appendSheet();
        console.log("append result", res.data);
    } catch (err) {
        console.error(err && err.response.data && err.response.data.error);
    }
}

main();