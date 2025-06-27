import axios from 'axios';
import { Logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';

/**
 * Search for accommodation using Booking.com-style search
 * @param {string} location - Location to search (city, country, etc.)
 * @param {string} checkin - Check-in date (YYYY-MM-DD)
 * @param {string} checkout - Check-out date (YYYY-MM-DD)
 * @param {number} adults - Number of adults (default: 2)
 * @param {number} rooms - Number of rooms (default: 1)
 * @returns {string} Accommodation search results
 */
export async function searchAccommodation(location, checkin, checkout, adults = 2, rooms = 1) {
  try {
    Logger.log(`Searching accommodation: ${location}, ${checkin} to ${checkout}, ${adults} adults, ${rooms} rooms`);
        
    // For now, we'll use a web search approach to find accommodation
    // Since we don't have direct Booking.com API access, we'll search for hotels
    const searchQuery = `${location} hotels ${checkin} to ${checkout} booking accommodation`;
        
    const data = JSON.stringify({
      'q': searchQuery,
      'num': 8
    });
        
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://google.serper.dev/search',
      headers: { 
        'X-API-KEY': CONFIG.SERPER_API_KEY, 
        'Content-Type': 'application/json'
      },
      data: data,
      timeout: 10000
    };

    const response = await axios.request(config);
    const results = response.data;
        
    let resultSummary = `🏨 Accommodation Search for "${location}"\n`;
    resultSummary += `📅 ${checkin} to ${checkout} • ${adults} adults • ${rooms} room(s)\n\n`;
        
    // Check for featured snippets with booking info
    if (results.answerBox) {
      resultSummary += `💡 Quick Info:\n${results.answerBox.answer || results.answerBox.snippet}\n\n`;
    }
        
    // Include top booking-related results
    if (results.organic && results.organic.length > 0) {
      resultSummary += '🔗 Booking Options:\n';
      let hotelCount = 0;
      results.organic.forEach((result, index) => {
        if (hotelCount < 10 && (
          result.link.includes('booking.com') || 
                    result.link.includes('hotels.com') || 
                    result.link.includes('expedia.com') ||
                    result.link.includes('airbnb.com') ||
                    result.title.toLowerCase().includes('hotel') ||
                    result.title.toLowerCase().includes('accommodation')
        )) {
          resultSummary += `${hotelCount + 1}. ${result.title}\n`;
          resultSummary += `   ${result.snippet}\n`;
          resultSummary += `   Book: ${result.link}\n\n`;
          hotelCount++;
        }
      });
    }
        
    // Add helpful booking tips
    resultSummary += '💡 Booking Tips:\n';
    resultSummary += '• Compare prices across multiple sites\n';
    resultSummary += '• Check cancellation policies\n';
    resultSummary += '• Read recent reviews\n';
    resultSummary += '• Book directly with hotel for best rates';
        
    return resultSummary;
        
  } catch (error) {
    Logger.log(`Accommodation search error: ${error.message}`, 'error');
    return `Error searching for accommodation: ${error.message}`;
  }
}