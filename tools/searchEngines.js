import * as SearchService from '../services/searchService.js';
import { createSearchToolWrapper } from '../utils/toolWrapper.js';

// News search tool
export const performNewsSearch = createSearchToolWrapper(
  SearchService.performNewsSearch,
  {
    name: 'performNewsSearch',
    category: 'search',
    description: 'Search current news articles',
    resultIcon: '📰',
    emptyResultsMessage: 'No recent news found',
    formatResult: (news, params) => {
      const [query] = params;
      if (!news || news.length === 0) {
        return `📰 No recent news found for "${query}".`;
      }
      
      let summary = `📰 News Results for "${query}":\n\n`;
      news.slice(0, 10).forEach((article, index) => {
        summary += `${index + 1}. ${article.title}\n`;
        summary += `   ${article.snippet}\n`;
        summary += `   Source: ${article.source} • ${article.date || 'Recent'}\n`;
        summary += `   Link: ${article.link}\n\n`;
      });
      
      return summary;
    }
  }
);

// Places search tool
export const performPlacesSearch = createSearchToolWrapper(
  SearchService.performPlacesSearch,
  {
    name: 'performPlacesSearch',
    category: 'search',
    description: 'Search for places and locations',
    resultIcon: '📍',
    emptyResultsMessage: 'No places found',
    formatResult: (places, params) => {
      const [query] = params;
      if (!places || places.length === 0) {
        return `📍 No places found for "${query}".`;
      }
      
      let summary = `📍 Places Results for "${query}":\n\n`;
      places.slice(0, 10).forEach((place, index) => {
        summary += `${index + 1}. ${place.title}\n`;
        if (place.address) summary += `   📍 ${place.address}\n`;
        if (place.rating) summary += `   ⭐ ${place.rating} (${place.ratingCount || 0} reviews)\n`;
        if (place.phoneNumber) summary += `   📞 ${place.phoneNumber}\n`;
        if (place.website) summary += `   🌐 ${place.website}\n`;
        summary += '\n';
      });
      
      return summary;
    }
  }
);

// Image search tool
export const performImageSearch = createSearchToolWrapper(
  SearchService.performImageSearch,
  {
    name: 'performImageSearch',
    category: 'search',
    description: 'Search for images',
    resultIcon: '🖼️',
    emptyResultsMessage: 'No images found',
    formatResult: (images, params) => {
      const [query] = params;
      if (!images || images.length === 0) {
        return `🖼️ No images found for "${query}".`;
      }
      
      let summary = `🖼️ Image Search Results for "${query}":\n`;
      images.slice(0, 10).forEach((img, index) => {
        summary += `${index + 1}. ${img.title}\n`;
        summary += `   Source: ${img.source || 'Unknown'}\n`;
        summary += `   Link: ${img.link}\n`;
        if (img.imageUrl) summary += `   Image URL: ${img.imageUrl}\n`;
        summary += '\n';
      });
      
      return summary;
    }
  }
);

// Video search tool
export const performVideoSearch = createSearchToolWrapper(
  SearchService.performVideoSearch,
  {
    name: 'performVideoSearch',
    category: 'search',
    description: 'Search for videos',
    resultIcon: '🎥',
    emptyResultsMessage: 'No videos found',
    formatResult: (videos, params) => {
      const [query] = params;
      if (!videos || videos.length === 0) {
        return `🎥 No videos found for "${query}".`;
      }
      
      let summary = `🎥 Video Search Results for "${query}":\n`;
      videos.slice(0, 10).forEach((video, index) => {
        summary += `${index + 1}. ${video.title}\n`;
        summary += `   Channel: ${video.channel || 'Unknown'}\n`;
        summary += `   Duration: ${video.duration || 'N/A'}\n`;
        summary += `   Link: ${video.link}\n`;
        if (video.date) summary += `   Published: ${video.date}\n`;
        summary += '\n';
      });
      
      return summary;
    }
  }
);

// Alternative sites search tool
export const searchUnpopularSites = createSearchToolWrapper(
  SearchService.searchAlternativeSites,
  {
    name: 'searchUnpopularSites',
    category: 'search',
    description: 'Search alternative/niche sites for diverse perspectives',
    resultIcon: '🔍',
    emptyResultsMessage: 'No alternative sources found',
    formatResult: (results, params) => {
      const [query] = params;
      if (!results || results.length === 0) {
        return `🔍 No alternative sources found for "${query}".`;
      }
      
      let summary = `🔍 Alternative Sources for "${query}":\n\n`;
      results.slice(0, 10).forEach((result, index) => {
        summary += `${index + 1}. ${result.title}\n`;
        summary += `   ${result.snippet}\n`;
        summary += `   Source: ${result.link}\n\n`;
      });
      
      return summary;
    }
  }
);