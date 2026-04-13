/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';

// 🔹 GOOGLE TOKEN VERIFICATION
export const verifyGoogleToken = async (token: string) => {
  try {
    const response = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${token}`,
    );

    const user = response.data; // { id, email, name, picture, verified_email, locale, ... }

    return {
      id: user.id || null,
      name: user.name || null,
      given_name: user.given_name || null,
      family_name: user.family_name || null,
      email: user.email || null,
      verified_email: user.verified_email ?? null,
      imgUrl: user.picture || null,
      locale: user.locale || null,
      hd: user.hd || null, // hosted domain if from Google Workspace
      kind: user.kind || 'google#userInfo',
      provider: 'google',
    };
  } catch (error: any) {
    console.error(
      'Invalid Google token:',
      error.response?.data || error.message,
    );
    return null;
  }
};

// 🔹 GITHUB TOKEN VERIFICATION
export const verifyGithubToken = async (token: string) => {
  try {
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const user = userResponse.data;

    // If email is null, fetch verified emails separately
    let email = user.email;
    if (!email) {
      try {
        const emailResponse = await axios.get(
          'https://api.github.com/user/emails',
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        const emails = emailResponse.data;
        const primaryEmail = emails.find(
          (e: any) => e.primary && e.verified,
        )?.email;
        email = primaryEmail || null;
      } catch (emailError: any) {
        console.error(
          'Error fetching GitHub emails:',
          emailError.response?.data || emailError.message,
        );
      }
    }

    return {
      id: user.id || null,
      login: user.login || null,
      name: user.name || user.login || null,
      email,
      bio: user.bio || null,
      company: user.company || null,
      blog: user.blog || null,
      location: user.location || null,
      imgUrl: user.avatar_url || null,
      html_url: user.html_url || null,
      twitter_username: user.twitter_username || null,
      followers: user.followers || 0,
      following: user.following || 0,
      created_at: user.created_at || null,
      updated_at: user.updated_at || null,
      provider: 'github',
    };
  } catch (error: any) {
    console.error(
      'Invalid GitHub token:',
      error.response?.data || error.message,
    );
    return null;
  }
};
