from dotenv import load_dotenv
load_dotenv()

import os, re, json, unicodedata

import tweepy
from tweepy import Stream,OAuthHandler

from datetime import datetime, timedelta

import nltk
# nltk.download('stopwords')
from nltk.corpus import stopwords
stop_words = stopwords.words('spanish')
from nltk.tokenize import TweetTokenizer
tweet_tokenizer = TweetTokenizer(strip_handles=True, reduce_len=True)

import gensim
import gensim.corpora as corpora
from gensim.utils import lemmatize, simple_preprocess

import pandas as pd
import numpy as np

####------------- PARAMETERS -------------####

DEBUG = False

CONSUMER_KEY = os.getenv("TWITTER_CONSUMER_KEY")
CONSUMER_SECRET = os.getenv("TWITTER_CONSUMER_SECRET")
ACCESS_TOKEN = os.getenv("TWITTER_ACCESS_TOKEN_KEY")
ACCESS_TOKEN_SECRET = os.getenv("TWITTER_ACCESS_TOKEN_SECRET")

CURRENT_TIME = datetime.utcnow()                    # current date and time in UTC
SEARCH_TIME = CURRENT_TIME - timedelta(minutes=5)     # look for tweets one hour back in time

### Search API parameters
SEARCH_QUERY = ''
GEOCODE = '6.244203,-75.5812119,40km'
LANG = 'es'
RESULT_TYPE = 'recent'   # mixed, recent or popular
RESULTS_PER_CALL = 100  # Max is 100 for Standard API

FILENAME = 'tweets_from_week_search.jsonl'  # Where the Tweets should be saved

PRINT_AFTER_X = 100 # Script prints an update to the CLI every time it collected another X Tweets

# LDA topics
NUM_TOPICS = 10

####------------- CODE -------------####

def login():

    # Log in
    auth = tweepy.OAuthHandler(CONSUMER_KEY, CONSUMER_SECRET)
    auth.set_access_token(ACCESS_TOKEN, ACCESS_TOKEN_SECRET)

    api = tweepy.API(auth, 
            # support for multiple authentication handlers  
            # retry 3 times with 5 seconds delay when getting these error codes
            # For more details see 
            # https://dev.twitter.com/docs/error-codes-responses  
            retry_count=3,retry_delay=5,retry_errors=set([401, 404, 500, 503]), 
            # monitor remaining calls and block until replenished  
            wait_on_rate_limit=True,
            wait_on_rate_limit_notify=True 
    )

    json_str = json.dumps(api.me()._json, ensure_ascii=False)
    parsed_json = json.loads(json_str)
    if DEBUG: print( 'Logged to Twitter API with {} account'.format(parsed_json['name']) )

    return api

def tweet_collection(api):
    
    if DEBUG: print('Starting Tweet Collection from {} until {}'.format(CURRENT_TIME,SEARCH_TIME))

    last_tweet_id = False
    args = {}
    tweets_counter = 0
    tweets_data = []
    keep_whiling = True

    while True:

        if last_tweet_id: args = {'max_id':last_tweet_id}
        tweets = tweepy.Cursor(
                                api.search, 
                                q = SEARCH_QUERY, 
                                count = RESULTS_PER_CALL,
                                result_type = RESULT_TYPE,
                                include_entities = True,      
                                geocode = GEOCODE,
                                lang = LANG,
                                tweet_mode = 'extended',
                                **args
                            ).items()

        for tweet in tweets:
            text, tweet_id, date = parse_tweet(tweet._json)
            tweets_data.append({
                'text': text,
                'id': tweet_id,
                'date': date
            })
            tweets_counter += 1

            if tweets_counter % PRINT_AFTER_X == 0:
                # print('{}:\t {}\t {}'.format(tweets_counter, date.isoformat(), text))
                if DEBUG: print(date - SEARCH_TIME, end='\r')
            
            if not(date > SEARCH_TIME): 
                return tweets_data

def parse_tweet(tweet_json):

    tweet_json_str = json.dumps(tweet_json, ensure_ascii=False)
    tweet = json.loads(tweet_json_str)
    tweet_id = tweet['id']
    tweet_date = datetime.strptime(tweet['created_at'],"%a %b %d %H:%M:%S +0000 %Y")

    tweet_text_list = []

    # If tweet is truncated and has extended_tweet entity
    if tweet['truncated'] and 'extended_tweet' in tweet:
        # parse tweet entities from extended_tweet
        tweet_text_list.append(tweet['extended_tweet']['full_text'])
    else:
        # keep tweet entities from root level
        tweet_text_list.append(tweet['full_text'])

    if 'retweeted_status' in tweet:
        tweet_text_list.append(tweet['retweeted_status']['full_text'])

    if 'retweeted_status' in tweet and 'extended_tweet' in tweet['retweeted_status']:
        tweet_text_list.append(tweet['retweeted_status']['extended_tweet']['full_text'])

    if 'retweeted_status' in tweet:
        tweet_text_list.append(tweet['retweeted_status']['full_text'])

    if 'quoted_status' in tweet:
        tweet_text_list.append(tweet['quoted_status']['full_text'])

    if 'quoted_status' in tweet and 'extended_tweet' in tweet['quoted_status']:
        tweet_text_list.append(tweet['quoted_status']['extended_tweet']['full_text'])

    tweet_text = max(tweet_text_list, key=len)

    return tweet_text, tweet_id, tweet_date

def remove_emoji(string):
    emoji_pattern = re.compile("["
                               u"\U0001F600-\U0001F64F"  # emoticons
                               u"\U0001F300-\U0001F5FF"  # symbols & pictographs
                               u"\U0001F680-\U0001F6FF"  # transport & map symbols
                               u"\U0001F1E0-\U0001F1FF"  # flags (iOS)
                               u"\U00002500-\U00002BEF"  # chinese char
                               u"\U00002702-\U000027B0"
                               u"\U00002702-\U000027B0"
                               u"\U000024C2-\U0001F251"
                               u"\U0001f926-\U0001f937"
                               u"\U00010000-\U0010ffff"
                               u"\u2640-\u2642"
                               u"\u2600-\u2B55"
                               u"\u200d"
                               u"\u23cf"
                               u"\u23e9"
                               u"\u231a"
                               u"\ufe0f"  # dingbats
                               u"\u3030"
                               "]+", flags=re.UNICODE)
    return emoji_pattern.sub(r'', string)

def remove_accents(input_str):
    nfkd_form = unicodedata.normalize('NFKD', input_str)
    return u"".join([c for c in nfkd_form if not unicodedata.combining(c)])

def tokenize(text):
    
    punctuation='[^-¡!()%/—.,¿?«»;"’:“”_...|]+'

    text = re.sub('RT', '', text)    # remove retweet tag      
    text = text.lower()      # lowercase text
    text = re.sub(r"(?:\@|http?\://|https?\://|www|\#[\w\_])\S+", "", str(text))   # remove urls, mentions and hashtags
    text = re.sub(r'\s+', ' ', text)  # remove newline chars
    text = re.sub(r"\'", "", text)  # remove single quotes
    text = re.sub(r'\"', "", text)  # remove double quotes
    text = re.sub(r'\b(a*ha+h[ha]*|a*ja+j[ja]*)\b', "", text)  # remove jajaja
    text = remove_emoji(text)
    text = remove_accents(text)
    tokens = tweet_tokenizer.tokenize(text)        # tokenize
    tokens = [token for token in tokens if (token not in punctuation)]              # remove punctuation
    tokens = [token for token in tokens if (token not in stop_words)]              # remove stopwords

    return tokens

def explore_topic(lda_model, topic_number, topn, output=True):
    """
    accept a ldamodel, atopic number and topn vocabs of interest
    prints a formatted list of the topn terms
    """
    terms = []
    for term, frequency in lda_model.show_topic(topic_number, topn=topn):
        terms += [term]
        if output and DEBUG:
            print(u'{:20} {:.3f}'.format(term, round(frequency, 3)))
    
    return terms

if __name__ == "__main__":
        
    api = login()
    tweets = tweet_collection(api)
    tweets_df = pd.DataFrame( tweets , columns=['text', 'id', 'date'])

    # tokenize
    tweets_df['tokens'] = tweets_df['text'].apply(tokenize)

    documents = tweets_df['tokens'].values
    id2word = corpora.Dictionary(documents) # Create Dictionary
    corpus = [id2word.doc2bow(text) for text in documents]                   # Create Corpus: Term Document Frequency  
    # build LDA model
    lda_model = gensim.models.ldamodel.LdaModel(corpus=corpus,
                                               id2word=id2word,
                                               num_topics=NUM_TOPICS, 
                                               random_state=254,
                                               update_every=1,
                                               chunksize=1000,
                                               passes=2,
                                               alpha=0.01,
                                               eta=0.1,
                                               iterations=100,
                                               per_word_topics=True)
    
    # if DEBUG: print(lda_model.print_topics())

    # topic_summaries = []
    # if DEBUG: print(u'{:20} {}'.format(u'term', u'frequency') + u'\n')
    # for i in range(NUM_TOPICS):
    #     print('Topic '+str(i)+' |---------------------\n')
    #     tmp = explore_topic(lda_model,topic_number=i, topn=10, output=True )
    #     topic_summaries += [tmp[:5]]

    # Get topic weights
    topic_weights = []
    for i, row_list in enumerate( lda_model[ corpus ] ):
        topic_weights.append([w for i, w in row_list[0]])
    arr = pd.DataFrame(topic_weights).fillna(0).values
    topic_num = np.argmax(arr, axis=1)

    tweets_df['weigths'] = list(arr)
    tweets_df['topic'] = topic_num

    tweets_df = tweets_df.drop(columns=['tokens'])
    if DEBUG:
        print('# of docs:', tweets_df.shape[0]) 
        print(tweets_df.head())

    if not DEBUG: 
        print(tweets_df.to_json(orient='records'))