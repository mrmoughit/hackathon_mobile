import { OAuth2 } from 'oauth';
import axios from 'axios';

const UID = 'u-s4t2ud-b42809efe39077ea73a357c1b611b8326306239717e2a5e82cde990292c7ee37';
const SECRET = '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';

export async function getAccessToken() {
    const client = new OAuth2(
        UID,
        SECRET,
        'https://api.intra.42.fr',
        null,
        '/oauth/token',
        null
    );

    return new Promise((resolve, reject) => {
        client.getOAuthAccessToken(
            '',
            { grant_type: 'client_credentials' },
            (error, token) => {
                if (error) {
                    console.error('Error getting OAuth token:', JSON.stringify(error, null, 2));
                    reject('Error getting OAuth token');
                } else {
                    resolve(token);
                }
            }
        );
    });
}


let records = [];
export async function fetchData(accessToken, page) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        console.log("Fetching page", page);
        
        const response = await axios.get(
            `https://api.intra.42.fr/v2/teams?filter[campus]=16&filter[status]=waiting_for_correction,finished&sort=-updated_at&page[number]=${page}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                }
            }
        );

        let pageRecords = [];
        let allToday = true;

        response.data.forEach(item => {
            const createdAt = item.updated_at;
            const createdAtDate = createdAt.split('T')[0];
            const login = item.users[0].login;
            pageRecords.push({
                login: login,
                project: item.project_gitlab_path.split('/').pop(),
                intra_url: `https://profile.intra.42.fr/users/${login}`,
                status: item.status,
                final_mark: item.final_mark,
                gitlab_url: item.project_gitlab_path,
                group_name: item.name,
                img: 'https://cdn.intra.42.fr/users/9ae5b3303aaceb68d7a6e580c60545a4/yzoullik.jpg',  // Placeholder image
                created_at: createdAt
            });

            if (createdAtDate !== today) {
                allToday = false;
            }
        });

        const todayRecords = pageRecords.filter(item => item.created_at.split('T')[0] === today);
       
        const uniqueRecords = Object.values(
            todayRecords.reduce((acc, current) => {
                if (!acc[current.login] || 
                    new Date(current.created_at) > new Date(acc[current.login].created_at)) {
                    acc[current.login] = current;
                }
                return acc;
            }, {})
        );
        
        return { uniqueRecords, allToday };
    } catch (error) {
        // console.log(error);
        console.log('Error fetching data: fetch data function ');
        // throw error;
        return null;
    }
}

