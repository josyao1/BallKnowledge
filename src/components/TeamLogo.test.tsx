import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TeamLogo } from './TeamLogo';

describe('TeamLogo', () => {
  it('renders an img with correct src for valid team', () => {
    render(<TeamLogo sport="nba" abbr="LAL" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png');
    expect(img).toHaveAttribute('alt', 'LAL');
  });

  it('renders with custom size', () => {
    render(<TeamLogo sport="nba" abbr="BOS" size={64} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('width', '64');
    expect(img).toHaveAttribute('height', '64');
  });

  it('falls back to text on image error', () => {
    render(<TeamLogo sport="nba" abbr="LAL" />);
    const img = screen.getByRole('img');
    fireEvent.error(img);
    // After error, img should be replaced with text fallback
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('LAL')).toBeInTheDocument();
  });

  it('renders text fallback when getTeamLogoUrl returns null', () => {
    render(<TeamLogo sport="nba" abbr="" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders NFL logos', () => {
    render(<TeamLogo sport="nfl" abbr="KC" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png');
  });

  it('applies custom className', () => {
    render(<TeamLogo sport="nba" abbr="LAL" className="custom-class" />);
    const img = screen.getByRole('img');
    expect(img.className).toContain('custom-class');
  });

  it('defaults size to 48', () => {
    render(<TeamLogo sport="nba" abbr="LAL" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('width', '48');
    expect(img).toHaveAttribute('height', '48');
  });
});
