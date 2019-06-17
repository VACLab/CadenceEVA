package edu.unc.vaclab.cadence.data.vocab.icd10;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class ICDBlock {

    protected ArrayList<ICDBlock> children;
    protected String start;
    protected String end;
    protected String label;

    public ICDBlock(String _start, String _end, String _label) {
            start = _start;
            end = _end;
            label = _label;
            children = new ArrayList<>();
    }

    public String getStart() {
        return start;
    }

    public String getEnd() {
        return end;
    }

    public String getLabel() {
        return label;
    }

    private boolean subsumes(String _code) {
        if ((_code.compareTo(this.start) >= 0) && (_code.compareTo(this.end) <= 0)) {
            return true;
        }
        else {
            return false;
        }
    }

    private boolean subsumes(ICDBlock _block) {
        if ((_block.start.compareTo(this.start) >= 0) && (_block.end.compareTo(this.end) <= 0)) {
                return true;
        }
        else if ((_block.start.compareTo(this.start) < 0) && (_block.end.compareTo(this.start) < 0)) {
            return false;
        }
        else if ((_block.start.compareTo(this.end) > 0) && (_block.end.compareTo(this.end) > 0)) {
            return false;
        }
        else {
            System.err.println("ERROR! INVALID OVERLAP WITH CODE RANGES.");
            return false;
        }
    }

    private void addChild(ICDBlock child_block) {
        // Look for an existing child that contains the new child block.
        for (ICDBlock _block : children) {
            if (_block.subsumes(child_block)) {
                _block.addChild(child_block);
                return;
            }
        }

        // If not existing child has been found, add it as a child of this block.
        this.children.add(child_block);
    }

    public List<ICDBlock> getParentChain(String _code) {
        // Get only the prefix of the code, prior to any dot.
        int dot_index = _code.indexOf('.');
        if (dot_index > 0) {
            _code = _code.substring(0, dot_index);
        }

        // Find the child that contains the code.
        for (ICDBlock _child :this.children) {
            if (_child.subsumes(_code)) {
                // We've found the parent.
                List<ICDBlock> parent_chain = new ArrayList<>();
                parent_chain.add(_child);
                parent_chain.addAll(_child.getParentChain(_code));
                return parent_chain;
            }
        }

        // If the code has not been found, return an empty list.
        return new ArrayList<>();
    }

    public String toString() {
        return "[" + start + "-" + end + "]";
    }

    public static ICDBlock parseRangeFile(String _filename) {

        // Create a block object for the root of the ICD10 tree.
        ICDBlock _root = new ICDBlock("A00", "Z99", "ICD10CM");

        // Load the block file.
        try {
            CSVParser input_parser = CSVParser.parse(new File(_filename), StandardCharsets.UTF_8, CSVFormat.RFC4180.withHeader());

            input_parser.getHeaderMap();
            for (CSVRecord _item : input_parser) {
                // Get the values
                String _block = _item.get("Block");
                String _title = _item.get("Title");
                String _chapter = _item.get("Chapter");

                // The block is a string with a hyphen in the middle of the start and end values.  Split.
                String[] _tokens = _block.split("-" );
                if (_tokens.length < 2) {
                    // System.out.println("Skipping block without range: " + _tokens[0]);
                }
                else {
                    // Create a new block object.
                    ICDBlock new_block = new ICDBlock(_tokens[0], _tokens[1], _chapter + ". " + _title);
                    _root.addChild(new_block);
                }
            }
        }
        catch (Exception e) {
            System.err.println(e);
            return null;
        }
        return _root;
    }

    public static void main(String args[]) {
        ICDBlock _root = ICDBlock.parseRangeFile("web/cfg/ICD10_chapters.csv");
        System.out.println("Done!");
    }
}


