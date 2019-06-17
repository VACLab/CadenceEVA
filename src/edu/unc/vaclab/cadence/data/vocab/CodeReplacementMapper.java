package edu.unc.vaclab.cadence.data.vocab;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

public class CodeReplacementMapper {
    private Map<String,Map<String,String>> mappingTable;

    public CodeReplacementMapper(String mapping_file) {
        mappingTable = new HashMap<>();

        // Load the mapping file.
        try {
            CSVParser input_parser = CSVParser.parse(new File(mapping_file), StandardCharsets.UTF_8, CSVFormat.RFC4180.withHeader());

            input_parser.getHeaderMap();
            for (CSVRecord _item : input_parser) {
                // Get the values
                String _class = _item.get("class");
                String old_code = _item.get("oldcode");
                String new_code = _item.get("newcode");

                // Is this the first entry of this class?  If so, create a new entry in the mapping table.
                Map<String,String> class_mapping = mappingTable.computeIfAbsent(_class, _c -> new HashMap<>());
                class_mapping.put(old_code, new_code);
            }
        }
        catch (Exception e) {
            System.err.println(e);
        }
    }

    public String map(String in_class, String in_code) {
        Map<String,String> class_mapping = mappingTable.get(in_class);
        if (class_mapping != null) {
            String out_code = class_mapping.get(in_code);
            if (out_code != null) {
                if (out_code.equals("IGNORE")) {
                        return null;
                }
                else {
                return out_code;
                }
            }
            else {
                return in_code;
            }
        }
        else {
            return in_code;
        }
    }
}
