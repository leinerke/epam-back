const axios = require('axios');

/**
 * @typedef {Object} IGetRouteToPicking
 * @property {string[]} author_key - Array of author keys
 * @property {string[]} author_name - Array of author names
 * @property {string} [cover_edition_key] - Optional cover edition key
 * @property {number} [cover_i] - Optional cover image ID
 * @property {'borrowable' | 'no_ebook' | 'printdisabled'} ebook_access - Ebook access type
 * @property {number} edition_count - Number of editions
 * @property {number} first_publish_year - First publication year
 * @property {boolean} has_fulltext - Whether the book has full text
 * @property {string} key - Unique book key
 * @property {strign[]} language - Array of languages
 * @property {boolean} public_scan_b - Whether public scanning is available
 * @property {string} title - Book title
 * @property {string[]} [ia] - Optional Internet Archive identifiers
 * @property {string} [ia_collection_s] - Optional Internet Archive collection
 * @property {string} [lending_edition_s] - Optional lending edition
 * @property {string} [lending_identifier_s] - Optional lending identifier
 */

/**
 * @typedef {Object} OpenLibrarySearchResponse
 * @property {IGetRouteToPicking[]} docs - Array of book documents
 * @property {number} numFound - Total number of results found
 * @property {number} start - Starting index of results
 * @property {number} numFoundExact - Exact number of results found
 */

class OpenLibrary {
  constructor() {
    this.axios = axios.create({
      baseURL: 'https://openlibrary.org',
    });
  }

  /**
   * @param {{ q: string, page?: number }} params
   * @returns {Promise<{
   *   title: string,
   *   author: string[],
   *   publicationYear: number,
   *   key: string,
   *   cover?: string,
   * }[]>}
   */
  async search({ q, page = 1 }) {
    /** @type {import('axios').AxiosResponse<OpenLibrarySearchResponse>} */
    const response = await this.axios.get('/search.json', {
      params: { title: q, page, limit: 10 },
    });

    return response.data.docs.map((book) => ({
      title: book.title,
      author: book.author_name,
      publicationYear: book.first_publish_year,
      key: book.key.split('/').pop(),
      cover: book.cover_i,
    }));
  }
}

const openLibrary = new OpenLibrary();

module.exports = { openLibrary };
