require('dotenv').config();
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const FormData = require('form-data');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(__dirname));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('Connected to MongoDB');
        startChangeStream();
    })
    .catch(err => console.error('MongoDB connection error:', err));

const orderSchema = new mongoose.Schema({
    fileName: String,
    userFile: {
        url: String,
        filename: String
    }
}, { collection: 'orders' });

const Order = mongoose.model('Order', orderSchema);

// Function to get token from GitHub
async function getToken() {
    try {
        const response = await axios.get('https://raw.githubusercontent.com/SanReg/automation/main/token.txt');
        const token = response.data.trim().replace(/\r?\n/g, '');
        console.log('Token fetched successfully');
        return token;
    } catch (error) {
        console.error('Error fetching token:', error.message);
        throw error;
    }
}

// Function to get cookie from GitHub
async function getCookie() {
    try {
        const response = await axios.get('https://raw.githubusercontent.com/SanReg/automation/main/Cookie.txt');
        const cookie = response.data.trim().replace(/\r?\n/g, '');
        console.log('Cookie fetched successfully');
        return cookie;
    } catch (error) {
        console.error('Error fetching cookie:', error.message);
        throw error;
    }
}

// Function to handle new order
async function handleNewOrder(order) {
    console.log('New order detected:', order);
    
    try {
        // Get the authorization token
        const token = await getToken();
        
        // Download the file from order.userFile.url
        const fileResponse = await axios.get(order.userFile.url, { 
            responseType: 'arraybuffer' 
        });
        
        // Prepare form data
        const fileName = order.userFile.filename || order.fileName || 'file';
        const formData = new FormData();
        formData.append('file', Buffer.from(fileResponse.data), fileName);
        
        // Post request to Supabase
        const supabaseUrl = `https://uvibhxfykplnajxopihb.supabase.co/storage/v1/object/files/bfbaac84-216b-4955-aa9e-ea25f4563e15/${fileName}`;
        
        console.log('Posting to Supabase with token...');
        const response = await axios.post(supabaseUrl, formData, {
            headers: {
                ...formData.getHeaders(),
                'apikey': 'sb_publishable_gn-VTqpQoi1gbd7OicsF4g_LcHf0SXr',
                'Authorization': token
            }
        });
        
        console.log('Supabase response:', response.data);
        
        // Extract key from Supabase response
        const supabaseKey = response.data.Key || response.data.key || response.data.name || fileName;
        const publicFileUrl = `https://uvibhxfykplnajxopihb.supabase.co/storage/v1/object/public/${supabaseKey}`;
        
        // Get cookie for ryne.ai request
        const cookie = await getCookie();
        
        // Post request to ryne.ai/api/deep-check
        console.log('Posting to Ryne.ai deep-check API...');
        const ryneResponse = await axios.post('https://ryne.ai/api/deep-check', 
            {
                uid: 'bfbaac84-216b-4955-aa9e-ea25f4563e15',
                fileUrl: publicFileUrl
            },
            {
                headers: {
                    'Cookie': '_gcl_au=1.1.494752539.1766075403; _ga=GA1.1.405476849.1766075403; _scid=oNEL9XFSnenLwO51_kfF3ZXmx3iw3O2-; _sctr=1%7C1768414500000; plan=ruby; _ScCbts=%5B%22183%3Bchrome.2%3A2%3A5%22%5D; crisp-client%2Fsession%2Fe48126d5-febc-4389-8221-ae0b3b531709=session_18c54c82-608e-43c3-9b42-80af84892460; _rdt_uuid=1766075403604.fefc30ad-e6b1-4c5c-914a-bf366f5cf79f; _scid_r=uFEL9XFSnenLwO51_kfF3ZXmx3iw3O2-uT_SOQ; sb-uvibhxfykplnajxopihb-auth-token.0=base64-eyJhY2Nlc3NfdG9rZW4iOiJleUpoYkdjaU9pSkZVekkxTmlJc0ltdHBaQ0k2SW1aaVlqTXlZak14TFRVeE5qUXRORGRqWkMwNU4ySXpMVFV4TW1Vd09UTXpPVGM1WVNJc0luUjVjQ0k2SWtwWFZDSjkuZXlKcGMzTWlPaUpvZEhSd2N6b3ZMM1YyYVdKb2VHWjVhM0JzYm1GcWVHOXdhV2hpTG5OMWNHRmlZWE5sTG1OdkwyRjFkR2d2ZGpFaUxDSnpkV0lpT2lKaVptSmhZV000TkMweU1UWmlMVFE1TlRVdFlXRTVaUzFsWVRJMVpqUTFOak5sTVRVaUxDSmhkV1FpT2lKaGRYUm9aVzUwYVdOaGRHVmtJaXdpWlhod0lqb3hOelk0TlRVd01ESTRMQ0pwWVhRaU9qRTNOamcxTkRZME1qZ3NJbVZ0WVdsc0lqb2liR0ZwYTI5cWRXNXBiM0l4TkVCbmJXRnBiQzVqYjIwaUxDSndhRzl1WlNJNklpSXNJbUZ3Y0Y5dFpYUmhaR0YwWVNJNmV5SndjbTkyYVdSbGNpSTZJbVZ0WVdsc0lpd2ljSEp2ZG1sa1pYSnpJanBiSW1WdFlXbHNJbDE5TENKMWMyVnlYMjFsZEdGa1lYUmhJanA3SW1OdmRXNTBjbmtpT2lJaUxDSmxiV0ZwYkNJNkljeGhhV3R2YW5WdWFXOXlNVFJBWjIxaGFXd3VZMjl0SWl3aVpXMWhhV3hmZFhCa1lYUmxjeUk2ZEhKMVpTd2laVzFoYVd4ZmRtVnlhV1pwWldRaU9uUnlkV1VzSW1aMWJHeGZibUZ0WlNJNkltOTFjM05oYldFZ2FHRmthbUZzSWl3aWFHVmhjbVJCWW05MWRGVnpJam9pU1c1emRHRm5jbUZ0SWl3aWNHaHZibVZmZG1WeWFXWnBaV1FpT21aaGJITmxMQ0p6ZFdJaU9pSmlabUpoWVdNNE5DMHlNVFppTFRRNU5UVXRZV0U1WlMxbFlUSTFaalExTmpObE1UVWlMQ0oyYVhOcGRHOXlTV1FpT2lJeVl6WTBPRFJqTURKaE1UTmhNV0pqWWpVd1pqUXpNamMwT0RBd1lXRmtNeUo5TENKeWIyeGxJam9pWVhWMGFHVnVkR2xqWVhSbFpDSXNJbUZoYkNJNkltRmhiREVpTENKaGJYSWlPbHQ3SW0xbGRHaHZaQ0k2SW5CaGMzTjNiM0prSWl3aWRHbHRaWE4wWVcxd0lqb3hOelk0TlRRMk5ESTRmVjBzSW5ObGMzTnBiMjVmYVdRaU9pSTFObVZoTURZMU9TMDBZV0ZpTFRSak9XUXRZV1F5WmkwME5tWXlNakZsWWpZMVlUSWlMQ0pwYzE5aGJtOXVlVzF2ZFhNaU9tWmhiSE5sZlEud2padTNTVlFhZ0hVcFNrcnhZZzlfVFZyTC1JaThNaHBuaTAzUTU0NGxEWVlkNWxuZ2Y3S2o4a280ek5ydDFuWlgzQkF4VUV3UG45akY4RlcyaWN0UGciLCJ0b2tlbl90eXBlIjoiYmVhcmVyIiwiZXhwaXJlc19pbiI6MzYwMCwiZXhwaXJlc19hdCI6MTc2ODU1MDAyOCwicmVmcmVzaF90b2tlbiI6ImRjam83YXJzbmtpbSIsInVzZXIiOnsiaWQiOiJiZmJhYWM4NC0yMTZiLTQ5NTUtYWE5ZS1lYTI1ZjQ1NjNlMTUiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJlbWFpbCI6ImxhaWtvanVuaW9yMTRAZ21haWwuY29tIiwiZW1haWxfY29uZmlybWVkX2F0IjoiMjAyNS0wNS0xNVQxODoyMjo1OC40NzM1ODZaIiwicGhvbmUiOiIiLCJjb25maXJtZWRfYXQiOiIyMDI1LTA1LTE1VDE4OjIyOjU4LjQ3MzU4NloiLCJsYXN0X3NpZ25faW5fYXQiOiIyMDI2LTAxLTE2VDA2OjUzOjQ4LjA3NjY4MDk1NVoiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJjb3VudHJ5IjoiIiwiZW1haWwiOiJsYWlrb2p1bmlvcjE0QGdtYWlsLmNvbSIsImVtYWlsX3VwZGF0ZXMiOnRydWUsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmdWxsX25hbWUiOiJvdXNzYW1hIGhhZGphbCIsImhlYXJkQWJvdXRVcyI6Ikluc3RhZ3JhbSIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiYmZiYWFjODQtMjE2Yi00OTU1LWFhOWUtZWEyNWY0NTYzZTA1IiwidmlzaXRvcklkIjoiMmM2NDg0YzAyYTEzYTFiY2I1MGY0MzI3NDgwMGFhZDMifSwiaWRlbnRpdGllcyI6W3siaWRlbnRpdHlfaWQiOiIxMGMxN2YzNS1jYWExLTQyYzYtYWQzYy0xOTBkMmRmNzllYjkiLCJpZCI6ImJmYmFhYzg0LTIxNmItNDk1NS1hYTllLWVhMjVmNDU2M2UxNSIsInVzZXJfaWQiOiJiZmJhYWM4NC0yMTZiLTQ5NTUtYWE5ZS1lYTI1ZjQ1NjNlMTUiLCJpZGVudGl0eV9kYXRhIjp7ImNvdW50cnkiOiIiLCJlbWFpbCI6ImxhaWtvanVuaW9yMTRAZ21haWwuY29tIiwiZW1haWxfdXBkYXRlcyI6dHJ1ZSwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZ1bGxfbmFtZSI6Im91c3NhbWEgaGFkamFsIiwiaGVhcmRBYm91dFVzIjoiSW5zdGFncmFtIiwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJyZWYiOm51bGwsInN1YiI6ImJmYmFhYzg0LTIxNmItNDk1NS1hYTllLWVhMjVmNDU2M2UxNSIsInZpc2l0b3JJZCI6IjJjNjQ4NGMwMmExM2ExYmNiNTBmNDMyNzQ4MDBhYWQzIn0sInByb3ZpZGVyIjoiZW1haWwiLCJsYXN0X3NpZ25faW5fYXQiOiIyMDI1LTA1LTE1VDE4OjIyOjIwLjI1NDI2OVoiL; sb-uvibhxfykplnajxopihb-auth-token.1=CJjcmVhdGVkX2F0IjoiMjAyNS0wNS0xNVQxODoyMjoyMC4yNTQzMTlaIiwidXBkYXRlZF9hdCI6IjIwMjUtMDUtMTVUMTg6MjI6MjAuMjU0MzE5WiIsImVtYWlsIjoibGFpa29qdW5pb3IxNEBnbWFpbC5jb20ifV0sImNyZWF0ZWRfYXQiOiIyMDI1LTA1LTE1VDE4OjIyOjIwLjI1MDM4WiIsInVwZGF0ZWRfYXQiOiIyMDI2LTAxLTE2VDA2OjUzOjQ4LjA4MTI0MVoiLCJpc19hbm9ueW1vdXMiOmZhbHNlfSwid2Vha19wYXNzd29yZCI6bnVsbH0; uid=bfbaac84-216b-4955-aa9e-ea25f4563e15; email=laikojunior14%40gmail.com; coins=1174426; ph_phc_WeGoeGPkghngqaB7jiW3BvjF2DslDxjbVQlDRzaIKnv_posthog=%7B%22distinct_id%22%3A%22bfbaac84-216b-4955-aa9e-ea25f4563e15%22%2C%22%24sesid%22%3A%5B1768546431452%2C%22019bc57a-1f20-7568-9c91-a21e5bfa74ff%22%2C1768544673568%5D%2C%22%24epp%22%3Atrue%2C%22%24initial_person_info%22%3A%7B%22r%22%3A%22%24direct%22%2C%22u%22%3A%22https%3A%2F%2Fryne.ai%2Fdashboard%22%7D%7D; limit=999999; _ga_4H1X7TYXHG=GS2.1.s1768544673$o28$g1$t1768546438$j52$l0$h940439545'
                }
            }
        );
        
        console.log('Ryne.ai response:', ryneResponse.data);
        
        // Get history_id from ryne.ai response
        const historyId = ryneResponse.data.history_id || ryneResponse.data.historyId || ryneResponse.data.id;
        
        if (historyId) {
            console.log('Starting polling for history_id:', historyId);
            startPolling(historyId, token);
        } else {
            console.log('No history_id found in ryne.ai response');
        }
        
        return ryneResponse.data;
    } catch (error) {
        console.error('Error handling order:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
    }
}

// Function to poll checks_history
async function startPolling(historyId, token) {
    const pollUrl = `https://uvibhxfykplnajxopihb.supabase.co/rest/v1/checks_history?id=eq.${historyId}`;
    
    const poll = async () => {
        try {
            const response = await axios.get(pollUrl, {
                headers: {
                    'apikey': 'sb_publishable_gn-VTqpQoi1gbd7OicsF4g_LcHf0SXr',
                    'Authorization': token
                }
            });
            
            console.log('Polling response:', response.data);
        } catch (error) {
            console.error('Polling error:', error.message);
            if (error.response) {
                console.error('Polling response data:', error.response.data);
            }
        }
    };
    
    // Poll immediately and then every 1 minute
    poll();
    setInterval(poll, 60000); // 60000ms = 1 minute
}

// Start change stream to listen for new orders
function startChangeStream() {
    const changeStream = Order.watch([
        { $match: { operationType: 'insert' } }
    ]);

    console.log('Listening for new orders in the orders collection...');

    changeStream.on('change', async (change) => {
        const newOrder = change.fullDocument;
        await handleNewOrder(newOrder);
    });

    changeStream.on('error', (error) => {
        console.error('Change stream error:', error);
    });
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
