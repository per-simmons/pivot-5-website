"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { formatDateET } from "@/lib/date-utils";

interface Article {
  id: string;
  headline: string;
  sourceName: string;
  originalUrl: string;
  dateIngested: string;
}

export function ArticlesTable() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArticles = async (skipCache = false) => {
    try {
      if (skipCache) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const url = `/api/airtable/articles?limit=50${skipCache ? "&refresh=true" : ""}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setArticles(data.articles || []);
      }
    } catch (err) {
      console.error("Error fetching articles:", err);
      setError("Failed to fetch articles");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          <span className="ml-2 text-zinc-500">Loading articles...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center text-zinc-500">
            <p className="text-red-500 mb-2">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchArticles(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-zinc-500">
            Showing {articles.length} most recent articles
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchArticles(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[45%]">Headline</TableHead>
                <TableHead className="w-[15%]">Source</TableHead>
                <TableHead className="w-[10%]">Link</TableHead>
                <TableHead className="w-[30%]">Date Ingested</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-zinc-500 py-8">
                    No articles found
                  </TableCell>
                </TableRow>
              ) : (
                articles.map((article) => (
                  <TableRow key={article.id}>
                    <TableCell className="max-w-[400px]">
                      <span className="line-clamp-2 text-sm">{article.headline}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-zinc-600">{article.sourceName}</span>
                    </TableCell>
                    <TableCell>
                      {article.originalUrl && (
                        <a
                          href={article.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-zinc-500">
                        {formatDateET(article.dateIngested)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Link to full Airtable */}
        <div className="mt-4 text-center">
          <a
            href="https://airtable.com/appwSozYTkrsQWUXB/tblGumae8KDpsrWvh"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            View full table in Airtable &rarr;
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
